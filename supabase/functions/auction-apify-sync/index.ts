/**
 * auction-apify-sync
 *
 * Sequential per-state Auction.com scrape via Apify actor.
 *
 *   sync    — create run, start first state actor (background)
 *   collect — poll active Apify run; on success upsert staging + start next state
 *   stop    — halt run
 *   GET     — status + recent runs + total listing count
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  loadApifyCredentials,
  startActorRun,
  fetchDatasetItems,
  getRunStatus,
  logApifyCall,
  DEFAULT_AUCTION_ACTOR_ID,
  type AuctionListingItem,
} from "../_shared/apify.ts";
import {
  filterAuctionItemsForIngest,
  activeAuctionNoEndCutoffIso,
} from "../_shared/auctionListingFilters.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_ITEMS_PER_STATE = 2000;
const MAX_START_FAILURES = 5;
const CONTROLLABLE = new Set(["running", "partial", "paused"]);
const TERMINAL_RUN = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "Washington DC",
];

interface RunMeta {
  pending_states?: string[];
  processed_states?: string[];
  active_state?: string | null;
  active_run_id?: string | null;
  total_states?: number;
  start_failures?: number;
  state_item_counts?: Record<string, number>;
  last_start_error?: string;
  sync_scope?: "all" | "count" | "selected";
  requested_state_count?: number;
  requested_states?: string[];
}

function resolveSyncStates(body: Record<string, unknown>): {
  states: string[];
  scope: "all" | "count" | "selected";
  requestedStateCount?: number;
  requestedStates?: string[];
} {
  const stateMode = body.stateMode as string | undefined;
  const stateCount = Number(body.stateCount);
  const rawStates = body.states;

  if (stateMode === "selected" && Array.isArray(rawStates)) {
    const selected = rawStates.filter(
      (s): s is string => typeof s === "string" && US_STATES.includes(s),
    );
    if (selected.length > 0) {
      return {
        states: selected,
        scope: "selected",
        requestedStates: selected,
      };
    }
  }

  if (stateMode === "count" && Number.isFinite(stateCount) && stateCount > 0) {
    const count = Math.min(Math.floor(stateCount), US_STATES.length);
    return {
      states: US_STATES.slice(0, count),
      scope: "count",
      requestedStateCount: count,
    };
  }

  return { states: [...US_STATES], scope: "all" };
}

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

function bearerToken(req: Request): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? null;
}

function isScheduledTrigger(req: Request, body: Record<string, unknown>): boolean {
  if (body._scheduledTrigger !== true) return false;
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  return !!serviceKey && bearerToken(req) === serviceKey;
}

function isServiceRoleRequest(req: Request): boolean {
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  return !!serviceKey && bearerToken(req) === serviceKey;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getRunRow(runId: string) {
  const { data } = await supabase
    .from("auction_apify_sync_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  return data ?? null;
}

async function updateRun(runId: string, patch: Record<string, unknown>): Promise<void> {
  await supabase.from("auction_apify_sync_runs").update(patch).eq("id", runId);
}

async function findControllableRun(runId?: string) {
  if (runId) {
    const data = await getRunRow(runId);
    return data && CONTROLLABLE.has(String(data.status)) ? data : null;
  }
  const { data } = await supabase
    .from("auction_apify_sync_runs")
    .select("*")
    .in("status", ["running", "partial", "paused"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function metaOf(run: { metadata?: unknown }): RunMeta {
  return (run.metadata ?? {}) as RunMeta;
}

function buildAuctionInput(state: string): Record<string, unknown> {
  return {
    buying_types: ["online", "in_person", "remote_bid", "offer"],
    enrichOutput: false,
    maxItems: MAX_ITEMS_PER_STATE,
    prop_types: ["single-family", "multi-family", "condos-townhouses", "land"],
    sale_types: ["foreclosures", "private-seller", "newly-foreclosed"],
    search_term: state,
  };
}

function parseTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapAuctionItemToStaging(
  runId: string,
  item: AuctionListingItem,
): Record<string, unknown> | null {
  const auctionId = String(item.id ?? "").trim();
  if (!auctionId) return null;

  const now = new Date().toISOString();
  return {
    auction_id: auctionId,
    sync_run_id: runId,
    url: item.url ?? null,
    address: item.address ?? null,
    state: item.country_primary_subdivision ?? null,
    county: item.country_secondary_subdivision ?? null,
    municipality: item.municipality ?? null,
    postal_code: item.postal_code ?? null,
    street_description: item.street_description ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    beds: item.beds ?? null,
    baths: item.baths ?? null,
    sqft: item.sqft ?? null,
    lot_sqft: item.lot_sqft ?? null,
    year_built: item.year_built ?? null,
    property_type: item.property_type ?? null,
    property_type_group: item.property_type_group ?? null,
    sale_type: item.saleType ?? null,
    opening_bid: item.opening_bid ?? null,
    starting_bid_amount: item.starting_bid_amount ?? null,
    auction_start_date: parseTimestamp(item.auction_start_date ?? undefined),
    auction_end_date: parseTimestamp(item.auction_end_date ?? undefined),
    auction_date: item.auctionDate ?? null,
    auction_time: item.auctionTime ?? null,
    auction_location: item.auctionLocation ?? null,
    status: item.status ?? null,
    occupancy_status: item.occupancy_status ?? null,
    buyer_premium_available: item.buyer_premium_available ?? false,
    interior_access_allowed: item.interior_access_allowed ?? false,
    is_first_look_enabled: item.is_first_look_enabled ?? false,
    is_direct_offer_enabled: item.is_direct_offer_enabled ?? false,
    primary_photo_url: item.primary_photo_url ?? null,
    raw: item,
    last_scraped_at: now,
  };
}

async function upsertStateItems(
  runId: string,
  items: AuctionListingItem[],
): Promise<number> {
  const { items: filtered, stats } = filterAuctionItemsForIngest(items);

  const rows = filtered
    .map((it) => mapAuctionItemToStaging(runId, it))
    .filter((r): r is Record<string, unknown> => r !== null);

  if (rows.length === 0) return 0;

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await supabase.from("auction_listing_staging").upsert(chunk, {
      onConflict: "auction_id",
      ignoreDuplicates: false,
    });
  }

  if (stats.skippedBankOwned > 0 || stats.skippedInactive > 0 || stats.skippedDuplicate > 0) {
    console.log(
      `[auction-apify-sync] ingest filter: kept=${stats.kept} bank_owned=${stats.skippedBankOwned} inactive=${stats.skippedInactive} dup=${stats.skippedDuplicate}`,
    );
  }

  return rows.length;
}

/** Remove bank-owned and ended auctions from staging. */
async function pruneStaleListings(): Promise<void> {
  const now = new Date().toISOString();
  const noEndStaleCutoff = activeAuctionNoEndCutoffIso();

  await supabase
    .from("auction_listing_staging")
    .delete()
    .ilike("sale_type", "%bank owned%");

  await supabase
    .from("auction_listing_staging")
    .delete()
    .lt("auction_end_date", now);

  await supabase
    .from("auction_listing_staging")
    .delete()
    .is("auction_end_date", null)
    .lt("auction_start_date", noEndStaleCutoff);
}

function applyListingQueryFilters<T extends {
  not: Function;
  or: Function;
}>(q: T): T {
  const now = new Date().toISOString();
  const noEndCutoff = activeAuctionNoEndCutoffIso();
  return q
    .not("sale_type", "ilike", "%bank owned%")
    .or(
      `and(auction_end_date.is.null,auction_start_date.gte.${noEndCutoff}),auction_end_date.gte.${now}`,
    ) as T;
}

async function countEligibleListings(): Promise<number> {
  let q = supabase
    .from("auction_listing_staging")
    .select("*", { count: "exact", head: true });
  q = applyListingQueryFilters(q);
  const { count } = await q;
  return count ?? 0;
}

async function startNextState(
  runId: string,
  creds: Awaited<ReturnType<typeof loadApifyCredentials>>,
): Promise<void> {
  const run = await getRunRow(runId);
  if (!run || !CONTROLLABLE.has(String(run.status))) return;

  const meta = metaOf(run);
  const pending = [...(meta.pending_states ?? [])];
  if (pending.length === 0) return;

  const state = pending.shift()!;
  const t0 = Date.now();

  try {
    const apifyRun = await startActorRun(
      creds.apiToken,
      DEFAULT_AUCTION_ACTOR_ID,
      buildAuctionInput(state),
    );

    await logApifyCall(supabase, creds.integrationId, {
      endpoint: `acts/${DEFAULT_AUCTION_ACTOR_ID}/runs`,
      status: 200,
      latencyMs: Date.now() - t0,
    });

    await updateRun(runId, {
      status: "partial",
      metadata: {
        ...meta,
        pending_states: pending,
        active_state: state,
        active_run_id: apifyRun.id,
        start_failures: 0,
        last_start_error: null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failures = (meta.start_failures ?? 0) + 1;

    if (failures >= MAX_START_FAILURES) {
      await updateRun(runId, {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Failed to start state "${state}" after ${failures} attempts: ${msg}`,
        metadata: {
          ...meta,
          pending_states: [state, ...pending],
          active_state: null,
          active_run_id: null,
          start_failures: failures,
          last_start_error: msg,
        },
      });
      return;
    }

    await updateRun(runId, {
      metadata: {
        ...meta,
        pending_states: [state, ...pending],
        active_state: null,
        active_run_id: null,
        start_failures: failures,
        last_start_error: msg,
      },
    });
  }
}

async function processActiveRun(
  runId: string,
  creds: Awaited<ReturnType<typeof loadApifyCredentials>>,
): Promise<{
  done: boolean;
  processedStates: number;
  pendingStates: number;
  listingsScraped: number;
  activeState: string | null;
  runStatus: string;
}> {
  const run = await getRunRow(runId);
  if (!run) {
    return {
      done: true,
      processedStates: 0,
      pendingStates: 0,
      listingsScraped: 0,
      activeState: null,
      runStatus: "failed",
    };
  }

  if (run.status === "stopped" || run.status === "success" || run.status === "failed") {
    const meta = metaOf(run);
    return {
      done: true,
      processedStates: (meta.processed_states ?? []).length,
      pendingStates: (meta.pending_states ?? []).length,
      listingsScraped: run.listings_scraped as number,
      activeState: null,
      runStatus: run.status as string,
    };
  }

  let meta = metaOf(run);
  const activeRunId = meta.active_run_id;

  if (activeRunId) {
    const apifyRun = await getRunStatus(creds.apiToken, activeRunId);
    if (!apifyRun) {
      return {
        done: false,
        processedStates: (meta.processed_states ?? []).length,
        pendingStates: (meta.pending_states ?? []).length,
        listingsScraped: run.listings_scraped as number,
        activeState: meta.active_state ?? null,
        runStatus: run.status as string,
      };
    }

    if (!TERMINAL_RUN.has(apifyRun.status)) {
      return {
        done: false,
        processedStates: (meta.processed_states ?? []).length,
        pendingStates: (meta.pending_states ?? []).length,
        listingsScraped: run.listings_scraped as number,
        activeState: meta.active_state ?? null,
        runStatus: run.status as string,
      };
    }

    if (apifyRun.status !== "SUCCEEDED") {
      const failures = (meta.start_failures ?? 0) + 1;
      const state = meta.active_state ?? "unknown";
      const msg = `Apify run ${activeRunId} for ${state} ended with ${apifyRun.status}`;

      if (failures >= MAX_START_FAILURES) {
        await updateRun(runId, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: msg,
          metadata: {
            ...meta,
            active_state: null,
            active_run_id: null,
            start_failures: failures,
            last_start_error: msg,
          },
        });
        return {
          done: true,
          processedStates: (meta.processed_states ?? []).length,
          pendingStates: (meta.pending_states ?? []).length,
          listingsScraped: run.listings_scraped as number,
          activeState: null,
          runStatus: "failed",
        };
      }

      const pending = meta.pending_states ?? [];
      await updateRun(runId, {
        metadata: {
          ...meta,
          pending_states: state ? [state, ...pending] : pending,
          active_state: null,
          active_run_id: null,
          start_failures: failures,
          last_start_error: msg,
        },
      });
    } else {
      let itemCount = 0;
      try {
        const items = await fetchDatasetItems<AuctionListingItem>(
          creds.apiToken,
          apifyRun.defaultDatasetId,
        );
        itemCount = await upsertStateItems(runId, items);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateRun(runId, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Fetch failed for ${meta.active_state}: ${msg}`,
        });
        return {
          done: true,
          processedStates: (meta.processed_states ?? []).length,
          pendingStates: (meta.pending_states ?? []).length,
          listingsScraped: run.listings_scraped as number,
          activeState: null,
          runStatus: "failed",
        };
      }

      const processed = [...(meta.processed_states ?? [])];
      const state = meta.active_state ?? "unknown";
      if (state && !processed.includes(state)) processed.push(state);

      const stateCounts = { ...(meta.state_item_counts ?? {}), [state]: itemCount };
      const newListingsScraped = (run.listings_scraped as number) + itemCount;

      await updateRun(runId, {
        listings_scraped: newListingsScraped,
        metadata: {
          ...meta,
          processed_states: processed,
          active_state: null,
          active_run_id: null,
          start_failures: 0,
          state_item_counts: stateCounts,
          last_start_error: null,
        },
      });

      run.listings_scraped = newListingsScraped;
      meta = {
        ...meta,
        processed_states: processed,
        active_state: null,
        active_run_id: null,
        state_item_counts: stateCounts,
      };
    }
  }

  const freshRun = await getRunRow(runId);
  if (!freshRun || !CONTROLLABLE.has(String(freshRun.status))) {
    return {
      done: true,
      processedStates: (meta.processed_states ?? []).length,
      pendingStates: (meta.pending_states ?? []).length,
      listingsScraped: run.listings_scraped as number,
      activeState: null,
      runStatus: freshRun?.status as string ?? "failed",
    };
  }

  meta = metaOf(freshRun);
  const pending = meta.pending_states ?? [];

  if (!meta.active_run_id && pending.length > 0) {
    await startNextState(runId, creds);
    const afterStart = await getRunRow(runId);
    meta = metaOf(afterStart ?? freshRun);
    return {
      done: false,
      processedStates: (meta.processed_states ?? []).length,
      pendingStates: (meta.pending_states ?? []).length,
      listingsScraped: (afterStart?.listings_scraped ?? run.listings_scraped) as number,
      activeState: meta.active_state ?? null,
      runStatus: (afterStart?.status ?? freshRun.status) as string,
    };
  }

  if (!meta.active_run_id && pending.length === 0) {
    await pruneStaleListings();
    await updateRun(runId, {
      status: "success",
      completed_at: new Date().toISOString(),
    });
    return {
      done: true,
      processedStates: (meta.processed_states ?? []).length,
      pendingStates: 0,
      listingsScraped: freshRun.listings_scraped as number,
      activeState: null,
      runStatus: "success",
    };
  }

  return {
    done: false,
    processedStates: (meta.processed_states ?? []).length,
    pendingStates: pending.length,
    listingsScraped: freshRun.listings_scraped as number,
    activeState: meta.active_state ?? null,
    runStatus: freshRun.status as string,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
  }

  const scheduled = isScheduledTrigger(req, body);

  if (req.method === "GET") {
    if (!isServiceRoleRequest(req)) {
      const ceoId = await requireCeo(req);
      if (!ceoId) return jsonResponse({ error: "Unauthorized" }, 403);
    }

    const { data: recentRuns } = await supabase
      .from("auction_apify_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);

    const totalListings = await countEligibleListings();

    const activeRun = (recentRuns ?? []).find((r) =>
      CONTROLLABLE.has(String(r.status))
    ) ?? null;

    return jsonResponse({
      recentRuns: recentRuns ?? [],
      totalListings,
      activeAuctionsOnly: true,
      activeRun,
      syncInProgress: !!activeRun,
    });
  }

  if (!scheduled) {
    const ceoId = await requireCeo(req);
    if (!ceoId) return jsonResponse({ error: "Unauthorized" }, 403);
  }

  const { action, runId } = body as { action?: string; runId?: string };
  if (!action) return jsonResponse({ error: "action is required" }, 400);

  if (action === "list") {
    const { data } = await supabase
      .from("auction_apify_sync_runs")
      .select("id, status, started_at, completed_at, listings_scraped, error_message, metadata")
      .order("started_at", { ascending: false })
      .limit(20);
    return jsonResponse({ runs: data ?? [] });
  }

  if (action === "listings") {
    const state = typeof body.state === "string" ? body.state : undefined;
    const saleType = typeof body.saleType === "string" ? body.saleType : undefined;
    const q = typeof body.q === "string" ? body.q.trim() : "";
    const sort = typeof body.sort === "string" ? body.sort : "auction_date_desc";
    const limit = Math.min(100, Math.max(1, Number(body.limit ?? 50)));
    const offset = Math.max(0, Number(body.offset ?? 0));

    let query = supabase
      .from("auction_listing_staging")
      .select("*", { count: "exact" });
    query = applyListingQueryFilters(query);

    if (state) query = query.eq("state", state);
    if (saleType) query = query.eq("sale_type", saleType);
    if (q) {
      // Escape PostgREST filter special chars used in or() values
      const escaped = q.replace(/[%_,.()\\]/g, "").slice(0, 80);
      if (escaped) {
        query = query.or(
          `address.ilike.%${escaped}%,street_description.ilike.%${escaped}%,municipality.ilike.%${escaped}%,postal_code.ilike.%${escaped}%,auction_id.ilike.%${escaped}%`,
        );
      }
    }

    if (sort === "bid_asc") {
      query = query.order("starting_bid_amount", { ascending: true, nullsFirst: false });
    } else if (sort === "bid_desc") {
      query = query.order("starting_bid_amount", { ascending: false, nullsFirst: false });
    } else {
      // Newest listed on Auction.com first
      query = query.order("auction_start_date", { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({
      listings: data ?? [],
      total: count ?? 0,
      activeAuctionsOnly: true,
    });
  }

  if (action === "stop") {
    const run = await findControllableRun(runId as string | undefined);
    if (!run) return jsonResponse({ error: "No active run to stop" }, 404);
    await updateRun(run.id, {
      status: "stopped",
      completed_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true, runId: run.id, status: "stopped" });
  }

  if (action === "collect") {
    if (!runId) return jsonResponse({ error: "runId is required" }, 400);

    let creds: Awaited<ReturnType<typeof loadApifyCredentials>>;
    try {
      creds = await loadApifyCredentials(supabase);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
    }

    const result = await processActiveRun(runId as string, creds);
    return jsonResponse({ ok: true, ...result });
  }

  if (action === "sync") {
    const active = await findControllableRun();
    if (active) {
      return jsonResponse(
        { error: `A run is already ${active.status}`, runId: active.id },
        409,
      );
    }

    let creds: Awaited<ReturnType<typeof loadApifyCredentials>>;
    try {
      creds = await loadApifyCredentials(supabase);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 400);
    }

    await pruneStaleListings();

    const syncStates = resolveSyncStates(body);
    if (syncStates.states.length === 0) {
      return jsonResponse({ error: "Select at least one state to sync" }, 400);
    }

    const initialMeta: RunMeta = {
      pending_states: syncStates.states,
      processed_states: [],
      active_state: null,
      active_run_id: null,
      total_states: syncStates.states.length,
      start_failures: 0,
      state_item_counts: {},
      sync_scope: syncStates.scope,
      ...(syncStates.requestedStateCount != null
        ? { requested_state_count: syncStates.requestedStateCount }
        : {}),
      ...(syncStates.requestedStates?.length
        ? { requested_states: syncStates.requestedStates }
        : {}),
    };

    const { data: newRun, error: runErr } = await supabase
      .from("auction_apify_sync_runs")
      .insert({
        status: "running",
        metadata: initialMeta,
      })
      .select()
      .single();

    if (runErr || !newRun) {
      return jsonResponse({ error: "Failed to create run record" }, 500);
    }

    EdgeRuntime.waitUntil(startNextState(newRun.id, creds));

    return jsonResponse({ ok: true, runId: newRun.id, status: "running" }, 202);
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400);
});

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
