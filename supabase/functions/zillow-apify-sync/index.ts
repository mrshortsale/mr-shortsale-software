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

const AGENT_BATCH_SIZE = 5;        // agent actor hard limit: max 5 propertyUrls per run
const MAX_COLLECT_PER_CALL = 20;   // max agent runs to process per collect_agents poll
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

  await updateRun(runId, {
    listings_scraped: stagingRows.length,
    metadata: {
      apify_search_run_id: searchRun.id,
      phase: "B_firing",
      agent_runs: [],
      listings_saved: stagingRows.length,
      detail_urls_found: detailUrls.length,
      sample_fields: sampleFields,
    },
  });

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

  // 6. Fire agent actor runs (don't wait — store run IDs for phase B)
  const totalBatchesPlanned = Math.ceil(detailUrls.length / AGENT_BATCH_SIZE);
  const agentRunIds: string[] = [];
  let failedBatches = 0;
  let lastStartError = "";
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
        endpoint: `acts/${creds.agentActorId}/runs`,
        status: 200,
        latencyMs: 0,
      });
    } catch (err) {
      failedBatches++;
      lastStartError = err instanceof Error ? err.message : String(err);
      await logApifyCall(supabase, creds.integrationId, {
        endpoint: `acts/${creds.agentActorId}/runs`,
        status: 500,
        latencyMs: 0,
        errorMessage: lastStartError,
      });
    }
  }

  // All batches failed to start
  if (agentRunIds.length === 0) {
    const limitHint = /limit|disabled|402|403/i.test(lastStartError)
      ? " — Apify account usage limit reached; raise the limit in Apify Console or upgrade the plan."
      : "";
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Agent actor failed to start for all ${detailUrls.length} URLs.${limitHint} Last error: ${lastStartError}`,
      metadata: {
        apify_search_run_id: searchRun.id,
        phase: "B_start_failed",
        detail_urls_found: detailUrls.length,
        failed_batches: failedBatches,
        last_start_error: lastStartError,
        sample_fields: sampleFields,
      },
    });
    return;
  }

  // Some batches failed to start (e.g. Apify usage limit hit mid-run). Surface it
  // in error_message so it isn't silently reported as "only N items processed".
  const partialWarning = failedBatches > 0
    ? `Started ${agentRunIds.length}/${totalBatchesPlanned} agent batches; ${failedBatches} failed to start (likely Apify usage limit). Last error: ${lastStartError}`
    : null;

  // Mark partial — phase B will be collected by collect_agents calls
  await updateRun(runId, {
    ...(partialWarning ? { error_message: partialWarning } : {}),
    status: "partial",
    metadata: {
      apify_search_run_id: searchRun.id,
      phase: "B",
      agent_runs: agentRunIds.map((id) => ({ id, processed: false })),
      total_batches: agentRunIds.length,
      batches_planned: totalBatchesPlanned,
      failed_batches: failedBatches,
      detail_urls_found: detailUrls.length,
      processed_batches: 0,
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

  // Only collect when Phase A has finished and agent runs have been fired
  if (run.status !== "partial") {
    return { processed: 0, stillPending: 0, done: false };
  }

  const meta = (run.metadata ?? {}) as {
    agent_runs?: { id: string; processed: boolean }[];
    processed_batches?: number;
  };
  const agentRuns = meta.agent_runs ?? [];

  // Shouldn't happen for "partial" runs, but handle defensively
  if (agentRuns.length === 0) {
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: "Run was marked partial but no agent run IDs were stored.",
    });
    return { processed: 0, stillPending: 0, done: true };
  }

  let newlyProcessed = 0;
  let stillPending = 0;
  let processedThisCall = 0;
  const updatedRuns = [...agentRuns];

  for (let i = 0; i < updatedRuns.length; i++) {
    const ar = updatedRuns[i];
    if (ar.processed) continue;

    // Cap per poll so we don't time out when many runs complete at once
    if (processedThisCall >= MAX_COLLECT_PER_CALL) {
      stillPending++;
      continue;
    }

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
      processedThisCall++;
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
      processedThisCall++;
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
      .select("id, display_name, enabled, last_synced_at")
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
