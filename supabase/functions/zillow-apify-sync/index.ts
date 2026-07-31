/**
 * zillow-apify-sync
 *
 * Two-phase sync designed to stay within edge-function timeouts:
 *
 * Phase A  (action: "sync")
 *   Start search actor → waitForRun (fast, ~30–90 s) → upsert staging
 *   → split detail URLs into batches (max 5 URLs each) → start ONLY the first
 *   agent run → store remaining batches in metadata → return status "partial"
 *
 * Phase B  (action: "collect_agents", polled by the frontend)
 *   Runs agent batches SEQUENTIALLY — one in flight at a time. Each poll:
 *     - checks the active agent run; if SUCCEEDED, fetch dataset + upsert leads
 *     - then starts the next pending batch (if any)
 *   Sequential execution avoids Apify's max-concurrent-run limit, which was
 *   silently failing most batches when they were all fired at once.
 *   When no active run and no pending batches remain: round-robin → "success".
 *
 * Other actions: pause | resume | stop | list
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  loadApifyCredentials,
  startActorRun,
  waitForRun,
  fetchDatasetItems,
  logApifyCall,
  buildExternalId,
  normalizePhone,
  type ZillowSearchItem,
  type ZillowAgentItem,
  type ApifyRunStatus,
} from "../_shared/apify.ts";
import {
  assignUnassignedZillowLeadsRoundRobin,
} from "../_shared/roundRobin.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const AGENT_BATCH_SIZE = 5;        // agent actor hard limit: max 5 propertyUrls per run
const MAX_START_FAILURES = 5;      // give up after this many consecutive failed batch starts
const CONTROLLABLE = new Set(["running", "partial", "paused"]);

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function requireCeo(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = (await verifyJwt(token)) as { sub: string; role: string };
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

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getRunRow(runId: string) {
  const { data } = await supabase
    .from("zillow_apify_sync_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  return data ?? null;
}

async function updateRun(runId: string, patch: Record<string, unknown>): Promise<void> {
  await supabase.from("zillow_apify_sync_runs").update(patch).eq("id", runId);
}

async function findControllableRun(runId?: string, profileId?: string) {
  if (runId) {
    const data = await getRunRow(runId);
    return data && CONTROLLABLE.has(String(data.status)) ? data : null;
  }
  const q = supabase
    .from("zillow_apify_sync_runs")
    .select("*")
    .in("status", ["running", "partial", "paused"])
    .order("started_at", { ascending: false })
    .limit(1);
  if (profileId) q.eq("profile_id", profileId);
  const { data } = await q.maybeSingle();
  return data ?? null;
}

// ─── Phase A: search scrape → staging + fire agent runs ──────────────────────

async function phaseA(
  runId: string,
  profileId: string,
  searchUrl: string,
  creds: Awaited<ReturnType<typeof loadApifyCredentials>>,
): Promise<void> {
  const t0 = Date.now();

  // 1. Start search actor
  let searchRun: ApifyRunStatus;
  try {
    // PAGINATION_WITH_ZOOM_IN is required for this actor to return results on large
    // geographic searches (whole state). It ignores maxItems on the Apify side, but
    // we cap the number of items we READ from the dataset via fetchDatasetItems + slice.
    searchRun = await startActorRun(creds.apiToken, creds.searchActorId, {
      searchUrls: [{ url: searchUrl }],
      extractionMethod: "PAGINATION_WITH_ZOOM_IN",
    });
    await updateRun(runId, {
      metadata: { apify_search_run_id: searchRun.id, phase: "A", agent_runs: [] },
    });
    await logApifyCall(supabase, creds.integrationId, {
      endpoint: `acts/${creds.searchActorId}/runs`,
      status: 200,
      latencyMs: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Phase A start failed: ${msg}`,
    });
    return;
  }

  // 2. Wait for search actor (usually ~30 s)
  let searchCompleted: ApifyRunStatus;
  try {
    searchCompleted = await waitForRun(creds.apiToken, searchRun.id, {
      timeoutMs: 5 * 60_000,
      intervalMs: 4_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Search actor failed: ${msg}`,
    });
    return;
  }

  // 3. Fetch all items from the search dataset — the search run is already paid for,
  //    so we stage and enrich every result the search returns.
  let items: ZillowSearchItem[];
  try {
    items = await fetchDatasetItems<ZillowSearchItem>(
      creds.apiToken,
      searchCompleted.defaultDatasetId,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Fetch search results failed: ${msg}`,
    });
    return;
  }

  // Store a sample of raw field names in metadata for debugging
  const sampleFields = items.length > 0 ? Object.keys(items[0]) : [];

  // 4. Upsert staging rows
  const stagingRows = items
    .map((it) => mapSearchItemToStaging(runId, it))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (stagingRows.length > 0) {
    await supabase.from("zillow_listing_staging").upsert(stagingRows, {
      onConflict: "sync_run_id,zpid",
      ignoreDuplicates: false,
    });
  }

  if (stagingRows.length === 0) {
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      listings_scraped: 0,
      error_message: `Search actor returned ${items.length} items but none had a valid zpid. Sample fields: ${sampleFields.join(", ")}`,
      metadata: { apify_search_run_id: searchRun.id, phase: "A_empty", sample_fields: sampleFields },
    });
    return;
  }

  // 5. Build detail URLs for agent scraper — process ALL staged listings (no cap)
  const detailUrls = stagingRows
    .map((r) => r.detail_url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  // Guard: if no valid URLs were extracted, bail with a clear diagnostic
  if (detailUrls.length === 0) {
    const sampleRaw = stagingRows[0]?.search_raw ?? {};
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Staged ${stagingRows.length} listings but extractDetailUrl returned empty for all. sample_raw below.`,
      metadata: {
        apify_search_run_id: searchRun.id,
        phase: "B_no_urls",
        sample_raw: sampleRaw,
        sample_fields: sampleFields,
      },
    });
    return;
  }

  // 6. Split detail URLs into agent-actor batches (max 5 URLs each). Batches run
  //    SEQUENTIALLY via collect_agents — one in flight at a time — so we never
  //    trip Apify's max-concurrent-run limit. Kick off only the FIRST batch here.
  const batches: string[][] = [];
  for (let i = 0; i < detailUrls.length; i += AGENT_BATCH_SIZE) {
    batches.push(detailUrls.slice(i, i + AGENT_BATCH_SIZE));
  }

  let firstRunId: string | null = null;
  let startError = "";
  try {
    const agentRun = await startActorRun(creds.apiToken, creds.agentActorId, {
      propertyUrls: batches[0],
    });
    firstRunId = agentRun.id;
    await logApifyCall(supabase, creds.integrationId, {
      endpoint: `acts/${creds.agentActorId}/runs`,
      status: 200,
      latencyMs: 0,
    });
  } catch (err) {
    startError = err instanceof Error ? err.message : String(err);
    await logApifyCall(supabase, creds.integrationId, {
      endpoint: `acts/${creds.agentActorId}/runs`,
      status: 500,
      latencyMs: 0,
      errorMessage: startError,
    });
  }

  if (!firstRunId) {
    const limitHint = /limit|disabled|402|403|429/i.test(startError)
      ? " — Apify account usage/concurrency limit reached; raise the limit in Apify Console or upgrade the plan."
      : "";
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Agent actor failed to start.${limitHint} Last error: ${startError}`,
      metadata: {
        apify_search_run_id: searchRun.id,
        phase: "B_start_failed",
        detail_urls_found: detailUrls.length,
        last_start_error: startError,
        sample_fields: sampleFields,
      },
    });
    return;
  }

  // Mark partial — the rest of the batches are run one-by-one by collect_agents.
  await updateRun(runId, {
    listings_scraped: stagingRows.length,
    status: "partial",
    metadata: {
      apify_search_run_id: searchRun.id,
      phase: "B",
      active_run_id: firstRunId,
      pending_batches: batches.slice(1),
      total_batches: batches.length,
      processed_batches: 0,
      detail_urls_found: detailUrls.length,
      start_failures: 0,
      sample_fields: sampleFields,
    },
  });
}

function extractDetailUrl(it: ZillowSearchItem): string {
  const raw = it as unknown as Record<string, unknown>;

  // 1. Preferred field names (most common across actor versions)
  for (const key of ["detailUrl", "url", "hdpUrl", "propertyUrl", "link", "listingUrl"]) {
    const v = raw[key];
    if (typeof v === "string" && v.includes("zillow.com")) return v;
  }

  // 2. Scan ALL string values for anything that looks like a Zillow listing URL
  for (const v of Object.values(raw)) {
    if (typeof v === "string" && v.includes("zillow.com/homedetails")) return v;
  }

  // 3. Construct from zpid — Zillow reliably redirects these
  const zpid = String(raw["zpid"] ?? it.zpid ?? "");
  if (zpid) return `https://www.zillow.com/homedetails/${zpid}_zpid/`;

  return "";
}

function mapSearchItemToStaging(runId: string, it: ZillowSearchItem) {
  const zpid = String(it.zpid ?? "");
  if (!zpid) return null;

  const price =
    it.unformattedPrice ??
    it.hdpData?.homeInfo?.price ??
    (typeof it.price === "number" ? it.price : undefined) ??
    null;

  const dom = it.daysOnZillow ?? it.hdpData?.homeInfo?.daysOnZillow ?? null;
  const zip =
    (it.addressZipcode as string | undefined) ??
    it.hdpData?.homeInfo?.zipcode ??
    null;

  return {
    sync_run_id: runId,
    zpid,
    detail_url: extractDetailUrl(it),
    address: it.addressStreet ?? it.address ?? null,
    city: it.addressCity ?? null,
    state: it.addressState ?? null,
    zipcode: zip,
    list_price: price !== undefined && price !== null ? price : null,
    days_on_market: dom !== null ? dom : null,
    broker_name: it.brokerName ?? null,
    search_raw: it as unknown as Record<string, unknown>,
  };
}

// ─── Phase B: collect completed agent runs + upsert agent leads ───────────────

async function collectAgents(
  runId: string,
  creds: Awaited<ReturnType<typeof loadApifyCredentials>>,
): Promise<{ processed: number; stillPending: number; done: boolean }> {
  const run = await getRunRow(runId);
  if (!run) return { processed: 0, stillPending: 0, done: true };

  // Only collect when Phase A has finished and an agent run has been fired
  if (run.status !== "partial") {
    return { processed: 0, stillPending: 0, done: false };
  }

  const meta = (run.metadata ?? {}) as {
    active_run_id?: string | null;
    pending_batches?: string[][];
    total_batches?: number;
    processed_batches?: number;
    start_failures?: number;
    [k: string]: unknown;
  };

  let activeRunId = meta.active_run_id ?? null;
  let pending = Array.isArray(meta.pending_batches) ? meta.pending_batches : [];
  let processedBatches = meta.processed_batches ?? 0;
  let startFailures = meta.start_failures ?? 0;
  const totalBatches = meta.total_batches ?? (processedBatches + pending.length + (activeRunId ? 1 : 0));

  let newlyProcessed = 0;

  // ── 1. Resolve the in-flight agent run, if any ──────────────────────────────
  if (activeRunId) {
    let apifyRun: ApifyRunStatus | null = null;
    try {
      const res = await fetch(
        `https://api.apify.com/v2/actor-runs/${activeRunId}`,
        { headers: { Authorization: `Bearer ${creds.apiToken}` } },
      );
      if (res.ok) {
        const json = await res.json() as { data: ApifyRunStatus };
        apifyRun = json.data;
      }
    } catch {
      apifyRun = null;
    }

    // Couldn't read status this poll — try again next poll.
    if (!apifyRun) {
      return { processed: 0, stillPending: pending.length + 1, done: false };
    }

    const terminal = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);
    if (!terminal.has(apifyRun.status)) {
      // Still running — wait for the next poll before doing anything else.
      return { processed: 0, stillPending: pending.length + 1, done: false };
    }

    // Run finished. If it succeeded, ingest its dataset.
    if (apifyRun.status === "SUCCEEDED") {
      try {
        const agentItems = await fetchDatasetItems<ZillowAgentItem>(
          creds.apiToken,
          apifyRun.defaultDatasetId,
        );
        newlyProcessed += await upsertAgentItems(agentItems, run.profile_id);
      } catch {
        // Dataset fetch failed — retry on the next poll, keep run active.
        return { processed: 0, stillPending: pending.length + 1, done: false };
      }
    }

    processedBatches++;
    activeRunId = null;
  }

  // ── 2. Start the next batch (sequential — one run at a time) ─────────────────
  let startError = "";
  if (!activeRunId && pending.length > 0) {
    const nextBatch = pending[0];
    try {
      const agentRun = await startActorRun(creds.apiToken, creds.agentActorId, {
        propertyUrls: nextBatch,
      });
      activeRunId = agentRun.id;
      pending = pending.slice(1);
      startFailures = 0;
      await logApifyCall(supabase, creds.integrationId, {
        endpoint: `acts/${creds.agentActorId}/runs`,
        status: 200,
        latencyMs: 0,
      });
    } catch (err) {
      startError = err instanceof Error ? err.message : String(err);
      startFailures++;
      await logApifyCall(supabase, creds.integrationId, {
        endpoint: `acts/${creds.agentActorId}/runs`,
        status: 500,
        latencyMs: 0,
        errorMessage: startError,
      });
    }
  }

  // Too many consecutive start failures (e.g. Apify usage limit) — give up.
  if (startFailures >= MAX_START_FAILURES) {
    const limitHint = /limit|disabled|402|403|429/i.test(startError)
      ? " — Apify account usage/concurrency limit reached; raise the limit in Apify Console or upgrade the plan."
      : "";
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      agents_upserted: (run.agents_upserted ?? 0) + newlyProcessed,
      error_message: `Agent actor failed to start ${startFailures}× in a row after ${processedBatches}/${totalBatches} batches.${limitHint} Last error: ${startError}`,
      metadata: {
        ...meta,
        active_run_id: null,
        pending_batches: pending,
        processed_batches: processedBatches,
        start_failures: startFailures,
      },
    });
    return { processed: newlyProcessed, stillPending: pending.length, done: true };
  }

  const allDone = !activeRunId && pending.length === 0;

  await updateRun(runId, {
    agents_upserted: (run.agents_upserted ?? 0) + newlyProcessed,
    metadata: {
      ...meta,
      active_run_id: activeRunId,
      pending_batches: pending,
      total_batches: totalBatches,
      processed_batches: processedBatches,
      start_failures: startFailures,
    },
    ...(allDone ? {
      status: "success",
      completed_at: new Date().toISOString(),
    } : {}),
  });

  if (allDone) {
    await assignUnassignedZillowLeadsRoundRobin(supabase);
    await supabase
      .from("zillow_apify_sync_profiles")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", run.profile_id);
  }

  return {
    processed: newlyProcessed,
    stillPending: pending.length + (activeRunId ? 1 : 0),
    done: allDone,
  };
}

async function upsertAgentItems(
  agentItems: ZillowAgentItem[],
  profileId: string,
): Promise<number> {
  let upserted = 0;

  for (const agent of agentItems) {
    const zpid = String(agent.zpid ?? "");
    const phone = normalizePhone(agent.agentPhoneNumber);
    const agentName = (agent.agentName ?? "").trim();
    const brokerName = (agent.brokerName ?? "").trim();

    // Skip unusable records: the actor returns all-null contact + a `message`
    // (e.g. "404: Not Found") when Zillow blocks the request. Storing these would
    // collapse every failure into a single "unknown:unknown" dedup row.
    const hasContact = Boolean(phone || agentName || brokerName);
    if (!hasContact) continue;

    const externalId = buildExternalId(phone, agentName, brokerName);

    // Join staging for property info
    const { data: stagingRow } = await supabase
      .from("zillow_listing_staging")
      .select("id, detail_url, address, city, state, zipcode, list_price, days_on_market")
      .eq("zpid", zpid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: existing } = await supabase
      .from("zillow_agent_leads")
      .select("id, listing_count")
      .eq("external_id", externalId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      const update: Record<string, unknown> = {
        listing_count: (existing.listing_count ?? 1) + 1,
        brokerage: brokerName || undefined,
        broker_phone: normalizePhone(agent.brokerPhoneNumber) || undefined,
        mls_name: agent.mlsName ?? undefined,
        true_status: agent.trueStatus ?? undefined,
        is_listed_by_owner: agent.isListedByOwner ?? false,
        updated_at: now,
      };
      if (stagingRow) {
        update.latest_zpid = zpid || undefined;
        update.latest_detail_url = stagingRow.detail_url;
        update.latest_property_address = stagingRow.address;
        update.latest_city = stagingRow.city;
        update.latest_state = stagingRow.state;
        update.latest_list_price = stagingRow.list_price;
        update.latest_days_on_market = stagingRow.days_on_market;
      }
      await supabase.from("zillow_agent_leads").update(update).eq("id", existing.id);
    } else {
      const insert: Record<string, unknown> = {
        profile_id: profileId,
        external_id: externalId,
        agent_name: agentName,
        agent_phone: phone,
        agent_email: agent.agentEmail ?? "",
        brokerage: brokerName,
        broker_phone: normalizePhone(agent.brokerPhoneNumber),
        mls_name: agent.mlsName ?? "",
        true_status: agent.trueStatus ?? null,
        is_listed_by_owner: agent.isListedByOwner ?? false,
        latest_zpid: zpid || null,
        status: "New",
      };
      if (stagingRow) {
        insert.latest_detail_url = stagingRow.detail_url;
        insert.latest_property_address = stagingRow.address;
        insert.latest_city = stagingRow.city;
        insert.latest_state = stagingRow.state;
        insert.latest_list_price = stagingRow.list_price;
        insert.latest_days_on_market = stagingRow.days_on_market;
      }
      await supabase.from("zillow_agent_leads").insert(insert);
    }

    // Mark staging row enriched
    if (stagingRow) {
      await supabase
        .from("zillow_listing_staging")
        .update({ agent_enriched_at: now })
        .eq("id", stagingRow.id);
    }

    upserted++;
  }

  return upserted;
}

// ─── Route handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // GET: aggregate status
  if (req.method === "GET") {
    const ceoId = await requireCeo(req);
    if (!ceoId) return jsonResponse({ error: "Unauthorized" }, 403);

    const { data: profiles } = await supabase
      .from("zillow_apify_sync_profiles")
      .select("id, display_name, enabled, last_synced_at, search_url, search_config")
      .order("display_name");

    const profileIds = (profiles ?? []).map((p) => p.id as string);
    const { data: recentRuns } = await supabase
      .from("zillow_apify_sync_runs")
      .select("*")
      .in("profile_id", profileIds.length > 0 ? profileIds : ["none"])
      .order("started_at", { ascending: false })
      .limit(50);

    const { count: totalLeads } = await supabase
      .from("zillow_agent_leads")
      .select("*", { count: "exact", head: true });

    return jsonResponse({ profiles: profiles ?? [], recentRuns: recentRuns ?? [], totalLeads });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const ceoId = await requireCeo(req);
  if (!ceoId) return jsonResponse({ error: "Unauthorized" }, 403);

  const { action, profileId, runId } = body as {
    action?: string; profileId?: string; runId?: string;
  };

  if (!action) return jsonResponse({ error: "action is required" }, 400);

  // List runs for a profile
  if (action === "list") {
    const q = supabase
      .from("zillow_apify_sync_runs")
      .select("id, profile_id, status, started_at, completed_at, listings_scraped, agents_upserted, error_message, metadata")
      .order("started_at", { ascending: false })
      .limit(20);
    if (profileId) q.eq("profile_id", profileId);
    const { data } = await q;
    return jsonResponse({ runs: data ?? [] });
  }

  // Pause
  if (action === "pause") {
    const run = await findControllableRun(runId, profileId);
    if (!run) return jsonResponse({ error: "No active run to pause" }, 404);
    await updateRun(run.id, { status: "paused" });
    return jsonResponse({ ok: true, runId: run.id, status: "paused" });
  }

  // Resume
  if (action === "resume") {
    const run = await findControllableRun(runId, profileId);
    if (!run || run.status !== "paused") return jsonResponse({ error: "No paused run found" }, 404);
    await updateRun(run.id, { status: "partial" });
    return jsonResponse({ ok: true, runId: run.id, status: "partial" });
  }

  // Stop
  if (action === "stop") {
    const run = await findControllableRun(runId, profileId);
    if (!run) return jsonResponse({ error: "No active run to stop" }, 404);
    await updateRun(run.id, {
      status: "stopped",
      completed_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true, runId: run.id, status: "stopped" });
  }

  // Collect agent results (poll from frontend every ~15 s while status is "partial")
  if (action === "collect_agents") {
    if (!runId) return jsonResponse({ error: "runId is required" }, 400);

    let creds: Awaited<ReturnType<typeof loadApifyCredentials>>;
    try {
      creds = await loadApifyCredentials(supabase);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
    }

    const result = await collectAgents(runId, creds);
    return jsonResponse({ ok: true, ...result });
  }

  // Start sync (Phase A)
  if (action === "sync") {
    if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

    const { data: profile } = await supabase
      .from("zillow_apify_sync_profiles")
      .select("id, display_name, search_url")
      .eq("id", profileId)
      .single();

    if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

    const active = await findControllableRun(undefined, profileId);
    if (active) {
      return jsonResponse(
        { error: `A run is already ${active.status} for this profile`, runId: active.id },
        409,
      );
    }

    let creds: Awaited<ReturnType<typeof loadApifyCredentials>>;
    try {
      creds = await loadApifyCredentials(supabase);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
    }

    const { data: newRun, error: runErr } = await supabase
      .from("zillow_apify_sync_runs")
      .insert({ profile_id: profileId, status: "running" })
      .select()
      .single();

    if (runErr || !newRun) return jsonResponse({ error: "Failed to create run record" }, 500);

    // Phase A runs in background (waitUntil keeps the function alive after response)
    EdgeRuntime.waitUntil(
      phaseA(newRun.id, profileId, profile.search_url, creds),
    );

    return jsonResponse({ ok: true, runId: newRun.id, status: "running" }, 202);
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400);
});

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
