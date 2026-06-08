/**
 * bridge-mls-sync
 *
 * Generic sync worker for all enabled Bridge MLS profiles.
 * Mirrors batchleads-sync lifecycle: run creation, background chunking,
 * pause/resume/stop, and per-run metadata tracking.
 *
 * GET  → aggregate + per-profile status
 * POST → action: sync | pause | resume | stop | list
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  loadBridgeCredentials,
  buildODataFilter,
  buildPropertyUrl,
  fetchPropertyPage,
  fetchMemberContacts,
  logBridgeApiCall,
  mapPropertyToAgentLead,
  type MlsSyncProfile,
  type AgentLeadRow,
} from "../_shared/bridge.ts";
import {
  assignRepsRoundRobin,
  loadActiveRepNames,
  loadRoundRobinIndex,
  REALTOR_MLS_SCOPE,
  saveRoundRobinIndex,
} from "../_shared/roundRobin.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

// A run is stale after 3 min of no update → auto-partial
const STALE_RUN_MS = 3 * 60 * 1000;
// Pages per foreground chunk before handing off to background
const MAX_PAGES_PER_CHUNK = 5;
const CONTROLLABLE_STATUSES = new Set(["running", "partial", "paused"]);

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function requireCeo(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return null;
    const { data } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", payload.sub)
      .single();
    if (!data || data.role !== "ceo" || !data.is_active) return null;
    return data.id;
  } catch {
    return null;
  }
}

function bearerToken(req: Request): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? null;
}

function isInternalContinue(req: Request, body: Record<string, unknown>): boolean {
  if (body._internalContinue !== true || !body.runId) return false;
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  return !!serviceKey && bearerToken(req) === serviceKey;
}

function isScheduledTrigger(req: Request, body: Record<string, unknown>): boolean {
  if (body._scheduledTrigger !== true) return false;
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  return !!serviceKey && bearerToken(req) === serviceKey;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function countAgentLeads(profileId: string): Promise<number> {
  const { count } = await supabase
    .from("mls_agent_leads")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId);
  return count ?? 0;
}

async function countTotalAgentLeads(): Promise<number> {
  const { count } = await supabase
    .from("mls_agent_leads")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function getRunStatus(runId: string): Promise<string | null> {
  const { data } = await supabase
    .from("realtor_sync_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  return data?.status ?? null;
}

async function findControllableRun(runId?: string, profileId?: string) {
  if (runId) {
    const { data } = await supabase
      .from("realtor_sync_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    return data && CONTROLLABLE_STATUSES.has(String(data.status)) ? data : null;
  }
  const q = supabase
    .from("realtor_sync_runs")
    .select("*")
    .in("status", ["running", "partial", "paused"])
    .order("started_at", { ascending: false })
    .limit(1);
  if (profileId) q.eq("profile_id", profileId);
  const { data } = await q.maybeSingle();
  return data ?? null;
}

async function reconcileStaleRun(run: Record<string, unknown> | null) {
  if (!run || run.status !== "running") return run;
  const updatedAt = run.updated_at
    ? new Date(String(run.updated_at)).getTime()
    : new Date(String(run.started_at)).getTime();
  if (Date.now() - updatedAt < STALE_RUN_MS) return run;
  const meta = (run.metadata ?? {}) as Record<string, unknown>;
  if (meta.completed || meta.nextSkip == null) return run;
  const agentsInDb = await countAgentLeads(String(run.profile_id));
  const { data } = await supabase
    .from("realtor_sync_runs")
    .update({
      status: "partial",
      leads_upserted: agentsInDb,
      error_message: "Sync paused — resume to fetch remaining pages",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();
  return data ?? { ...run, status: "partial" };
}

// ─── Background self-continue ─────────────────────────────────────────────────

function scheduleBackgroundContinue(runId: string, nextSkip: number): void {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bridge-mls-sync`;
  const key = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ action: "sync", runId, nextSkip, background: true, _internalContinue: true }),
  }).catch((err) => console.error("background bridge continue failed:", err));
}

// ─── Agent upsert ─────────────────────────────────────────────────────────────

/**
 * Upsert one page of agent leads.
 * Returns { newCount, updatedCount }.
 */
type RealtorRoundRobin = {
  repNames: string[];
  index: number;
};

async function upsertAgentLeads(
  rows: AgentLeadRow[],
  rr?: RealtorRoundRobin,
): Promise<{ newCount: number; updatedCount: number; assigned: number; nextIndex: number }> {
  if (rows.length === 0) {
    return { newCount: 0, updatedCount: 0, assigned: 0, nextIndex: rr?.index ?? 0 };
  }

  let nextIndex = rr?.index ?? 0;
  let assigned = 0;

  // ── Step 1: Deduplicate this batch by external_id (keep highest-DOM listing per agent) ──
  const batchMap = new Map<string, AgentLeadRow>();
  for (const row of rows) {
    const prev = batchMap.get(row.external_id);
    if (!prev || row.latest_days_on_market > prev.latest_days_on_market) {
      batchMap.set(row.external_id, row);
    }
  }
  const deduped = Array.from(batchMap.values());

  // ── Step 2: Check which external_ids already exist in the DB ──
  const externalIds = deduped.map((r) => r.external_id);
  const { data: existing } = await supabase
    .from("mls_agent_leads")
    .select("external_id, listing_count, latest_days_on_market, assigned_rep")
    .in("external_id", externalIds);

  const existingMap = new Map(
    (existing ?? []).map((e) => [e.external_id, e]),
  );

  const toInsert: Array<AgentLeadRow & { assigned_rep?: string }> = [];
  const toUpdate: Array<{ external_id: string; updates: Record<string, unknown> }> = [];

  const pickRep = (): string | null => {
    if (!rr || rr.repNames.length === 0) return null;
    const { assignments, nextIndex: ni } = assignRepsRoundRobin(rr.repNames, nextIndex, 1);
    nextIndex = ni;
    assigned++;
    return assignments[0];
  };

  for (const row of deduped) {
    const prev = existingMap.get(row.external_id);
    if (!prev) {
      const repName = pickRep();
      toInsert.push(repName ? { ...row, assigned_rep: repName } : row);
    } else {
      const updates: Record<string, unknown> = {
        listing_count: (prev.listing_count ?? 0) + 1,
        brokerage: row.brokerage || prev.brokerage,
        agent_phone: row.agent_phone || prev.agent_phone,
        agent_email: row.agent_email || prev.agent_email,
      };
      const activeRepSet = new Set(rr?.repNames ?? []);
      if (!prev.assigned_rep || !activeRepSet.has(prev.assigned_rep)) {
        const repName = pickRep();
        if (repName) updates.assigned_rep = repName;
      }
      if (row.latest_days_on_market > (prev.latest_days_on_market ?? 0)) {
        updates.latest_listing_id = row.latest_listing_id;
        updates.latest_property_address = row.latest_property_address;
        updates.latest_city = row.latest_city;
        updates.latest_state = row.latest_state;
        updates.latest_list_price = row.latest_list_price;
        updates.latest_days_on_market = row.latest_days_on_market;
        updates.latest_public_remarks = row.latest_public_remarks;
      }
      toUpdate.push({ external_id: row.external_id, updates });
    }
  }

  // ── Step 3: Insert new agents in chunks to avoid oversized payloads ──
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("mls_agent_leads").insert(chunk);
    if (error) {
      console.error("mls_agent_leads insert error:", error.message, "chunk start:", i);
    }
  }

  // ── Step 4: Update existing agents ──
  for (const { external_id, updates } of toUpdate) {
    const { error } = await supabase
      .from("mls_agent_leads")
      .update(updates)
      .eq("external_id", external_id);
    if (error) {
      console.error("mls_agent_leads update error:", error.message, "external_id:", external_id);
    }
  }

  return { newCount: toInsert.length, updatedCount: toUpdate.length, assigned, nextIndex };
}

// ─── Upsert raw property ──────────────────────────────────────────────────────

async function upsertRawProperties(
  profileId: string,
  properties: Array<{ listingId: string; listAgentKey: string | null; raw: Record<string, unknown> }>,
): Promise<void> {
  if (properties.length === 0) return;
  const rows = properties.map((p) => ({
    profile_id: profileId,
    listing_id: p.listingId,
    list_agent_key: p.listAgentKey,
    raw_payload: p.raw,
    synced_at: new Date().toISOString(),
  }));
  await supabase.from("bridge_property_raw").upsert(rows, { onConflict: "profile_id,listing_id" });
}

// ─── Core sync loop for one profile ──────────────────────────────────────────

async function syncProfile(params: {
  profile: MlsSyncProfile;
  runId: string;
  nextSkip: number;
  mode: "full" | "incremental";
  creds: { apiKey: string; baseUrl: string; integrationId: string; credentialId: string };
  maxPages?: number;
}): Promise<{
  completed: boolean;
  nextSkip: number | null;
  cumulativeNew: number;
  cumulativeUpdated: number;
  pagesProcessed: number;
  error: string | null;
}> {
  const { profile, runId, mode, creds } = params;
  let { nextSkip } = params;
  const maxPages = params.maxPages ?? MAX_PAGES_PER_CHUNK;

  const repNames = await loadActiveRepNames(supabase);
  let rrIndex = repNames.length > 0
    ? await loadRoundRobinIndex(supabase, REALTOR_MLS_SCOPE)
    : 0;

  // For incremental: get watermark from last successful run
  let since: string | undefined;
  if (mode === "incremental" && !profile.odata_filter_override) {
    const { data: lastSuccess } = await supabase
      .from("realtor_sync_runs")
      .select("completed_at")
      .eq("profile_id", profile.id)
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSuccess?.completed_at) {
      const ms = new Date(lastSuccess.completed_at).getTime() - 10 * 60 * 1000;
      since = new Date(ms).toISOString();
    }
  }

  const filter = buildODataFilter(profile, since);
  let pagesProcessed = 0;
  let cumulativeNew = 0;
  let cumulativeUpdated = 0;

  for (let i = 0; i < maxPages; i++) {
    // Check if paused/stopped between pages
    const runStatus = await getRunStatus(runId);
    if (runStatus === "paused" || runStatus === "stopped") {
      return { completed: false, nextSkip, cumulativeNew, cumulativeUpdated, pagesProcessed, error: null };
    }

    const url = buildPropertyUrl({
      baseUrl: creds.baseUrl,
      datasetId: profile.dataset_id,
      apiKey: creds.apiKey,
      filter,
      // No $select — let Bridge return all available fields; mapper picks what it knows
      top: profile.page_size,
      skip: nextSkip,
      orderBy: profile.sort_order,
    });

    const result = await fetchPropertyPage(url, creds.apiKey);

    await logBridgeApiCall(supabase, creds, {
      endpoint: `/api/v2/OData/${profile.dataset_id}/Property`,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      errorMessage: result.error,
    });

    if (result.error) {
      return { completed: false, nextSkip, cumulativeNew, cumulativeUpdated, pagesProcessed, error: result.error };
    }

    const properties = result.properties;
    pagesProcessed++;
    nextSkip += properties.length;

    // Map to agent rows (one per property)
    const agentRows = properties.map((p) => mapPropertyToAgentLead(p, profile));

    // Enrich with Member contact data for agents missing phone/email
    const agentKeysToEnrich = agentRows
      .filter((r) => !r.agent_phone && !r.agent_email && r.list_agent_key)
      .map((r) => r.list_agent_key as string);

    if (agentKeysToEnrich.length > 0) {
      const memberContacts = await fetchMemberContacts(
        creds.baseUrl, profile.dataset_id, creds.apiKey, agentKeysToEnrich,
      );
      for (const row of agentRows) {
        if (row.list_agent_key && memberContacts.has(row.list_agent_key)) {
          const contact = memberContacts.get(row.list_agent_key)!;
          if (!row.agent_phone) row.agent_phone = contact.phone;
          if (!row.agent_email) row.agent_email = contact.email;
        }
      }
    }

    const rr = repNames.length > 0 ? { repNames, index: rrIndex } : undefined;
    const { newCount, updatedCount, nextIndex } = await upsertAgentLeads(agentRows, rr);
    rrIndex = nextIndex;
    if (repNames.length > 0) {
      await saveRoundRobinIndex(supabase, rrIndex, repNames.length, REALTOR_MLS_SCOPE);
    }
    cumulativeNew += newCount;
    cumulativeUpdated += updatedCount;

    // Store raw payloads
    await upsertRawProperties(
      profile.id,
      properties.map((p) => ({
        listingId: p.ListingId ?? "",
        listAgentKey: p.ListAgentKey ?? null,
        raw: p as Record<string, unknown>,
      })),
    );

    // Update run metadata after each page
    const agentsInDb = await countAgentLeads(profile.id);
    await supabase
      .from("realtor_sync_runs")
      .update({
        leads_upserted: agentsInDb,
        metadata: {
          mode,
          nextSkip: properties.length < profile.page_size ? null : nextSkip,
          pagesProcessedTotal: nextSkip / profile.page_size,
          cumulativeNew,
          cumulativeUpdated,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    // Done: last page was smaller than page_size → no more data
    if (properties.length < profile.page_size || result.nextLink === null) {
      return { completed: true, nextSkip: null, cumulativeNew, cumulativeUpdated, pagesProcessed, error: null };
    }
  }

  // Reached maxPages — hand off to background
  return { completed: false, nextSkip, cumulativeNew, cumulativeUpdated, pagesProcessed, error: null };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // ── GET: aggregate status ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const ceoId = await requireCeo(req);
    if (!ceoId) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);

    const { credentials, error: credErr } = await loadBridgeCredentials(supabase);
    const bridgeConnected = !credErr;

    const { data: profiles } = await supabase
      .from("bridge_mls_sync_profiles")
      .select("id, dataset_id, display_name, enabled")
      .order("created_at");

    const profileStates = await Promise.all(
      (profiles ?? []).map(async (p) => {
        const agentsInDb = await countAgentLeads(p.id);
        const { data: lastRun } = await supabase
          .from("realtor_sync_runs")
          .select("*")
          .eq("profile_id", p.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const reconciled = await reconcileStaleRun(lastRun);
        const status = reconciled ? String(reconciled.status) : "";
        return {
          id: p.id,
          datasetId: p.dataset_id,
          displayName: p.display_name,
          enabled: p.enabled,
          syncInProgress: status === "running",
          canPause: status === "running",
          canResume: status === "paused" || status === "partial",
          canStop: CONTROLLABLE_STATUSES.has(status),
          agentsInDb,
          lastRun: reconciled ?? null,
        };
      }),
    );

    return jsonResponse({ bridgeConnected, profiles: profileStates });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const internal = isInternalContinue(req, body);
  const scheduled = isScheduledTrigger(req, body);

  if (!internal && !scheduled) {
    const ceoId = await requireCeo(req);
    if (!ceoId) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  const { action } = body;

  // ── LIST: paginated run history ────────────────────────────────────────────
  if (action === "list") {
    const { profileId, limit = 20, offset = 0 } = body as {
      profileId?: string; limit?: number; offset?: number;
    };
    let q = supabase
      .from("realtor_sync_runs")
      .select("*", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (profileId) q = q.eq("profile_id", profileId);
    const { data: runs, count, error } = await q;
    if (error) return jsonResponse({ error: "Failed to fetch runs" }, 500);
    return jsonResponse({ runs: runs ?? [], total: count ?? 0 });
  }

  // ── PAUSE ──────────────────────────────────────────────────────────────────
  if (action === "pause") {
    const { runId, profileId } = body as { runId?: string; profileId?: string };
    const run = await findControllableRun(runId as string | undefined, profileId as string | undefined);
    if (!run || run.status !== "running") {
      return jsonResponse({ error: "No active sync to pause" }, 400);
    }
    const agentsInDb = await countAgentLeads(String(run.profile_id));
    const { data } = await supabase
      .from("realtor_sync_runs")
      .update({
        status: "paused",
        leads_upserted: agentsInDb,
        error_message: "Paused by user",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("status", "running")
      .select("*")
      .single();
    if (!data) return jsonResponse({ error: "Sync already finished or paused" }, 409);
    return jsonResponse({ ok: true, run: data, agentsInDb });
  }

  // ── STOP ───────────────────────────────────────────────────────────────────
  if (action === "stop") {
    const { runId, profileId } = body as { runId?: string; profileId?: string };
    const run = await findControllableRun(runId as string | undefined, profileId as string | undefined);
    if (!run) return jsonResponse({ error: "No sync run to stop" }, 400);
    const agentsInDb = await countAgentLeads(String(run.profile_id));
    const { data } = await supabase
      .from("realtor_sync_runs")
      .update({
        status: "stopped",
        completed_at: new Date().toISOString(),
        leads_upserted: agentsInDb,
        error_message: "Stopped by user",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .in("status", ["running", "partial", "paused"])
      .select("*")
      .single();
    if (!data) return jsonResponse({ error: "Could not stop sync" }, 409);
    return jsonResponse({ ok: true, run: data, agentsInDb });
  }

  // ── RESUME ─────────────────────────────────────────────────────────────────
  if (action === "resume") {
    const { runId, profileId } = body as { runId?: string; profileId?: string };
    const run = await findControllableRun(runId as string | undefined, profileId as string | undefined);
    if (!run) return jsonResponse({ error: "No pausable run found" }, 400);
    if (run.status !== "paused" && run.status !== "partial") {
      return jsonResponse({ error: `Run status is '${run.status}' — cannot resume` }, 400);
    }
    await supabase
      .from("realtor_sync_runs")
      .update({ status: "running", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", run.id);
    const meta = (run.metadata ?? {}) as Record<string, unknown>;
    const nextSkip = Number(meta.nextSkip ?? 0);
    scheduleBackgroundContinue(String(run.id), nextSkip);
    return jsonResponse({ ok: true, runId: run.id, resumedFromSkip: nextSkip });
  }

  // ── SYNC ───────────────────────────────────────────────────────────────────
  if (action === "sync" || internal || scheduled) {
    const mode = (body.mode as "full" | "incremental") ?? (scheduled ? "incremental" : "full");
    const profileId = body.profileId as string | undefined;
    const runId = body.runId as string | undefined;
    const nextSkipFromBody = body.nextSkip != null ? Number(body.nextSkip) : 0;

    const { credentials, error: credErr } = await loadBridgeCredentials(supabase);
    if (credErr) return jsonResponse({ error: credErr }, 400);

    // If resuming an existing run (background continue or resume action)
    if (runId && internal) {
      const runStatus = await getRunStatus(runId);
      if (!runStatus || !CONTROLLABLE_STATUSES.has(runStatus)) {
        return jsonResponse({ ok: true, skipped: true, reason: "Run no longer active" });
      }

      // Load the profile from the run
      const { data: run } = await supabase
        .from("realtor_sync_runs")
        .select("profile_id, dataset_id, metadata")
        .eq("id", runId)
        .single();
      if (!run) return jsonResponse({ error: "Run not found" }, 404);

      const { data: profile } = await supabase
        .from("bridge_mls_sync_profiles")
        .select("*")
        .eq("id", run.profile_id)
        .single();
      if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

      const runMeta = (run.metadata ?? {}) as Record<string, unknown>;
      const result = await syncProfile({
        profile: profile as MlsSyncProfile,
        runId,
        nextSkip: nextSkipFromBody,
        mode: (runMeta.mode as "full" | "incremental") ?? mode,
        creds: credentials,
      });

      if (!result.completed && !result.error && result.nextSkip != null) {
        scheduleBackgroundContinue(runId, result.nextSkip);
      } else if (result.completed || result.error) {
        const agentsInDb = await countAgentLeads(profile.id);
        await supabase
          .from("realtor_sync_runs")
          .update({
            status: result.error ? "failed" : "success",
            completed_at: new Date().toISOString(),
            leads_upserted: agentsInDb,
            error_message: result.error,
            metadata: {
              ...runMeta,
              completed: result.completed,
              cumulativeNew: (Number(runMeta.cumulativeNew ?? 0)) + result.cumulativeNew,
              cumulativeUpdated: (Number(runMeta.cumulativeUpdated ?? 0)) + result.cumulativeUpdated,
            },
          })
          .eq("id", runId);

        if (result.completed) {
          await supabase
            .from("bridge_mls_sync_profiles")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", profile.id);
        }
      }

      return jsonResponse({ ok: true, runId, completed: result.completed, error: result.error });
    }

    // Fresh sync: determine which profiles to sync
    let profilesToSync: MlsSyncProfile[] = [];
    if (profileId) {
      const { data: p } = await supabase
        .from("bridge_mls_sync_profiles")
        .select("*")
        .eq("id", profileId)
        .single();
      if (p) profilesToSync = [p as MlsSyncProfile];
    } else {
      const { data: ps } = await supabase
        .from("bridge_mls_sync_profiles")
        .select("*")
        .eq("enabled", true)
        .order("created_at");
      profilesToSync = (ps ?? []) as MlsSyncProfile[];
    }

    if (profilesToSync.length === 0) {
      return jsonResponse({ error: "No enabled MLS profiles to sync. Enable at least one profile." }, 400);
    }

    const results = [];

    for (const profile of profilesToSync) {
      // Check for already-running sync on this profile
      const existingRun = await findControllableRun(undefined, profile.id);
      if (existingRun && existingRun.status === "running") {
        results.push({ profileId: profile.id, datasetId: profile.dataset_id, skipped: true, reason: "Already syncing" });
        continue;
      }

      // Create run record
      const { data: newRun } = await supabase
        .from("realtor_sync_runs")
        .insert({
          profile_id: profile.id,
          dataset_id: profile.dataset_id,
          status: "running",
          metadata: { mode, nextSkip: 0, cumulativeNew: 0, cumulativeUpdated: 0 },
        })
        .select()
        .single();

      if (!newRun) {
        results.push({ profileId: profile.id, datasetId: profile.dataset_id, error: "Failed to create run" });
        continue;
      }

      const result = await syncProfile({
        profile,
        runId: newRun.id,
        nextSkip: 0,
        mode,
        creds: credentials,
        maxPages: MAX_PAGES_PER_CHUNK,
      });

      if (!result.completed && !result.error && result.nextSkip != null) {
        // Hand off remaining pages to background
        scheduleBackgroundContinue(newRun.id, result.nextSkip);
        results.push({
          profileId: profile.id,
          datasetId: profile.dataset_id,
          runId: newRun.id,
          backgroundContinuing: true,
          pagesProcessed: result.pagesProcessed,
          cumulativeNew: result.cumulativeNew,
          cumulativeUpdated: result.cumulativeUpdated,
        });
      } else {
        // Completed or errored in the foreground chunk
        const agentsInDb = await countAgentLeads(profile.id);
        await supabase
          .from("realtor_sync_runs")
          .update({
            status: result.error ? "failed" : "success",
            completed_at: new Date().toISOString(),
            leads_upserted: agentsInDb,
            error_message: result.error,
            metadata: {
              mode,
              completed: result.completed,
              cumulativeNew: result.cumulativeNew,
              cumulativeUpdated: result.cumulativeUpdated,
            },
          })
          .eq("id", newRun.id);

        if (result.completed) {
          await supabase
            .from("bridge_mls_sync_profiles")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", profile.id);
        }

        results.push({
          profileId: profile.id,
          datasetId: profile.dataset_id,
          runId: newRun.id,
          completed: result.completed,
          cumulativeNew: result.cumulativeNew,
          cumulativeUpdated: result.cumulativeUpdated,
          error: result.error,
        });
      }
    }

    const totalAgents = await countTotalAgentLeads();
    return jsonResponse({ results, totalAgents });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
