/**
 * zillow-apify-sync
 *
 * Two-phase sync designed to stay within edge-function timeouts:
 *
 * Phase A  (action: "sync")
 *   Start search actor → waitForRun (fast, ~30–90 s) → upsert staging
 *   → fire all agent actor runs in parallel batches (fast, no wait)
 *   → store agent run IDs in metadata → return status "partial"
 *
 * Phase B  (action: "collect_agents")
 *   Poll stored agent run IDs → for each SUCCEEDED run, fetch dataset
 *   → upsert zillow_agent_leads (agent-primary) → mark enriched
 *   → when all runs done: round-robin assign → mark "success"
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

const AGENT_BATCH_SIZE = 200;
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
  maxListings: number,
  creds: Awaited<ReturnType<typeof loadApifyCredentials>>,
): Promise<void> {
  const t0 = Date.now();

  // 1. Start search actor
  let searchRun: ApifyRunStatus;
  try {
    searchRun = await startActorRun(creds.apiToken, creds.searchActorId, {
      searchUrls: [{ url: searchUrl }],
      maxItems: maxListings,
      extractionMethod: "PAGINATION_WITH_ZOOM_IN",
    });
    await updateRun(runId, {
      metadata: { apify_search_run_id: searchRun.id, phase: "A", agent_runs: [] },
    });
    await logApifyCall(supabase, creds.integrationId, {
      method: "POST",
      url: `acts/${creds.searchActorId}/runs`,
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

  // 3. Fetch dataset and cap to maxListings
  let items: ZillowSearchItem[];
  try {
    items = await fetchDatasetItems<ZillowSearchItem>(
      creds.apiToken,
      searchCompleted.defaultDatasetId,
      { limit: maxListings },
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

  // Cap to maxListings (actor may ignore maxItems with PAGINATION_WITH_ZOOM_IN)
  if (items.length > maxListings) items = items.slice(0, maxListings);

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

  await updateRun(runId, {
    listings_scraped: stagingRows.length,
    metadata: {
      apify_search_run_id: searchRun.id,
      phase: "B",
      agent_runs: [],
    },
  });

  if (stagingRows.length === 0) {
    await updateRun(runId, {
      status: "success",
      completed_at: new Date().toISOString(),
      agents_upserted: 0,
    });
    await supabase
      .from("zillow_apify_sync_profiles")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", profileId);
    return;
  }

  // 5. Fire agent actor runs (don't wait — store run IDs for phase B)
  const detailUrls = stagingRows
    .map((r) => r.detail_url)
    .filter(Boolean);

  const agentRunIds: string[] = [];
  for (let i = 0; i < detailUrls.length; i += AGENT_BATCH_SIZE) {
    const currentStatus = (await getRunRow(runId))?.status;
    if (currentStatus === "stopped") return;

    const batch = detailUrls.slice(i, i + AGENT_BATCH_SIZE);
    try {
      const agentRun = await startActorRun(creds.apiToken, creds.agentActorId, {
        propertyUrls: batch,
      });
      agentRunIds.push(agentRun.id);
      await logApifyCall(supabase, creds.integrationId, {
        method: "POST",
        url: `acts/${creds.agentActorId}/runs`,
        status: 200,
        latencyMs: 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logApifyCall(supabase, creds.integrationId, {
        method: "POST",
        url: `acts/${creds.agentActorId}/runs`,
        status: 500,
        latencyMs: 0,
        errorMessage: msg,
      });
    }
  }

  // Mark partial — phase B will be collected by collect_agents calls
  await updateRun(runId, {
    status: "partial",
    metadata: {
      apify_search_run_id: searchRun.id,
      phase: "B",
      agent_runs: agentRunIds.map((id) => ({ id, processed: false })),
      total_batches: agentRunIds.length,
      processed_batches: 0,
    },
  });
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
    detail_url: it.detailUrl ?? "",
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

  const meta = (run.metadata ?? {}) as {
    agent_runs?: { id: string; processed: boolean }[];
    processed_batches?: number;
  };
  const agentRuns = meta.agent_runs ?? [];

  if (agentRuns.length === 0) {
    await updateRun(runId, {
      status: "success",
      completed_at: new Date().toISOString(),
    });
    return { processed: 0, stillPending: 0, done: true };
  }

  let newlyProcessed = 0;
  let stillPending = 0;
  const updatedRuns = [...agentRuns];

  for (let i = 0; i < updatedRuns.length; i++) {
    const ar = updatedRuns[i];
    if (ar.processed) continue;

    // Check Apify run status
    let apifyRun: ApifyRunStatus;
    try {
      const res = await fetch(
        `https://api.apify.com/v2/actor-runs/${ar.id}`,
        { headers: { Authorization: `Bearer ${creds.apiToken}` } },
      );
      if (!res.ok) { stillPending++; continue; }
      const json = await res.json() as { data: ApifyRunStatus };
      apifyRun = json.data;
    } catch {
      stillPending++;
      continue;
    }

    const terminal = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);
    if (!terminal.has(apifyRun.status)) {
      stillPending++;
      continue;
    }

    if (apifyRun.status !== "SUCCEEDED") {
      updatedRuns[i] = { ...ar, processed: true };
      continue;
    }

    // Fetch and process results
    try {
      const agentItems = await fetchDatasetItems<ZillowAgentItem>(
        creds.apiToken,
        apifyRun.defaultDatasetId,
      );
      const count = await upsertAgentItems(agentItems, run.profile_id);
      newlyProcessed += count;
      updatedRuns[i] = { ...ar, processed: true };
    } catch {
      stillPending++;
    }
  }

  const processedBatches = updatedRuns.filter((r) => r.processed).length;
  const allDone = stillPending === 0 && processedBatches === agentRuns.length;

  await updateRun(runId, {
    agents_upserted: (run.agents_upserted ?? 0) + newlyProcessed,
    metadata: {
      ...meta,
      agent_runs: updatedRuns,
      processed_batches: processedBatches,
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
    stillPending,
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
    const agentName = agent.agentName ?? "";
    const brokerName = agent.brokerName ?? "";
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
      .select("id, display_name, enabled, last_synced_at, max_listings")
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
      .select("id, display_name, search_url, max_listings")
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
      phaseA(newRun.id, profileId, profile.search_url, profile.max_listings, creds),
    );

    return jsonResponse({ ok: true, runId: newRun.id, status: "running" }, 202);
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400);
});

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
