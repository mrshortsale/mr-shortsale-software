import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";
import {
  buildInsertRow,
  buildUpdateRow,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_PAGE_SIZE,
  disqualifyReason,
  fetchSavedAddressesPage,
  loadBatchLeadsCredentials,
  logBatchApiCall,
  mapBatchRowToInventoryLead,
  type SyncMode,
} from "../_shared/batchleads.ts";
import {
  assignRepsRoundRobin,
  loadActiveRepIds,
  loadRoundRobinIndex,
  saveRoundRobinIndex,
} from "../_shared/roundRobin.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

// Clock-skew buffer applied when computing the incremental watermark
const WATERMARK_BUFFER_MS = 10 * 60 * 1000; // 10 minutes
const STALE_RUN_MS = 3 * 60 * 1000;
const RESUMABLE_STATUSES = new Set(["running", "partial", "paused"]);
const CONTROLLABLE_STATUSES = new Set(["running", "partial", "paused"]);

type RunStatus = string;

interface RunMeta {
  nextPage?: number;
  mode?: SyncMode;
  since?: string;
  maxPages?: number;
  startPage?: number;
  lastPage?: number;
  totalAvailable?: number;
  completed?: boolean;
  // Cumulative across all background chunks of this run
  cumulativeNew?: number;
  cumulativeUpdated?: number;
  pagesProcessedTotal?: number;
  // Ingest-time filter counters (cumulative across the run)
  filteredEquity?: number;
  filteredFiling?: number;
  filteredApn?: number;
  qualifiedTotal?: number;
  // Round-robin assignment counters
  leadsAutoAssigned?: number;
  assignmentSkippedNoReps?: boolean;
  roundRobinRepCount?: number;
}

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

/** True when the request comes from the midnight cron trigger (service role key bearer). */
function isScheduledTrigger(req: Request, body: Record<string, unknown>): boolean {
  if (body._scheduledTrigger !== true) return false;
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  return !!serviceKey && bearerToken(req) === serviceKey;
}

async function countBatchLeads(): Promise<number> {
  const { count } = await supabase
    .from("inventory_leads")
    .select("*", { count: "exact", head: true })
    .eq("source", "Batch");
  return count ?? 0;
}

async function getRunStatus(runId: string): Promise<RunStatus | null> {
  const { data } = await supabase
    .from("inventory_sync_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  return data?.status ?? null;
}

async function findControllableRun(runId?: string): Promise<Record<string, unknown> | null> {
  if (runId) {
    const { data } = await supabase
      .from("inventory_sync_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    return data && CONTROLLABLE_STATUSES.has(String(data.status)) ? data : null;
  }

  const { data } = await supabase
    .from("inventory_sync_runs")
    .select("*")
    .eq("source", "Batch")
    .in("status", ["running", "partial", "paused"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function reconcileStaleRun(
  run: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!run || run.status !== "running") return run;

  const updatedAt = run.updated_at
    ? new Date(String(run.updated_at)).getTime()
    : new Date(String(run.started_at)).getTime();
  if (Date.now() - updatedAt < STALE_RUN_MS) return run;

  const meta = (run.metadata ?? {}) as RunMeta;
  if (meta.completed || meta.nextPage == null) return run;

  const leadsInDb = await countBatchLeads();
  const { data } = await supabase
    .from("inventory_sync_runs")
    .update({
      status: "partial",
      leads_upserted: leadsInDb,
      error_message: "Sync paused — resume to fetch remaining leads",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();

  return data ?? { ...run, status: "partial", leads_upserted: leadsInDb };
}

function scheduleBackgroundContinue(
  runId: string,
  startPage: number,
  maxPages: number,
): void {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/batchleads-sync`;
  const key = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!;

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify({
      action: "sync",
      runId,
      startPage,
      maxPages,
      background: true,
      _internalContinue: true,
    }),
  }).catch((err) => console.error("background sync continue failed:", err));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runFlags(lastRun: Record<string, unknown> | null, leadsInDb: number) {
  const status = lastRun ? String(lastRun.status) : "";
  const meta = (lastRun?.metadata ?? {}) as RunMeta;

  return {
    leadsInDb,
    syncInProgress: status === "running",
    canPause: status === "running",
    canResume: (status === "paused" || status === "partial"),
    canStop: CONTROLLABLE_STATUSES.has(status),
    lastRunMode: meta.mode ?? "full",
    progress: lastRun
      ? {
          completed: meta.completed === true || status === "success",
          nextPage: meta.nextPage ?? null,
          totalAvailable: meta.totalAvailable ?? null,
          leadsInDb,
          // Cumulative stats across all chunks of the current run
          cumulativeNew: meta.cumulativeNew ?? 0,
          cumulativeUpdated: meta.cumulativeUpdated ?? 0,
          pagesProcessedTotal: meta.pagesProcessedTotal ?? 0,
        }
      : null,
  };
}

/** Returns the last successful sync's completed_at minus the buffer, as ISO string. */
async function getIncrementalWatermark(): Promise<string | null> {
  const { data } = await supabase
    .from("inventory_sync_runs")
    .select("completed_at")
    .eq("source", "Batch")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.completed_at) return null;

  const ms = new Date(data.completed_at).getTime() - WATERMARK_BUFFER_MS;
  return new Date(ms).toISOString();
}

async function handlePause(runId?: string) {
  const run = await findControllableRun(runId);
  if (!run || run.status !== "running") {
    return jsonResponse({ error: "No active sync to pause" }, 400);
  }

  const leadsInDb = await countBatchLeads();
  const { data } = await supabase
    .from("inventory_sync_runs")
    .update({
      status: "paused",
      leads_upserted: leadsInDb,
      error_message: "Paused by user",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "running")
    .select("*")
    .single();

  if (!data) {
    return jsonResponse({ error: "Sync already finished or paused" }, 409);
  }

  return jsonResponse({ ok: true, run: data, leadsInDb });
}

async function handleStop(runId?: string) {
  const run = await findControllableRun(runId);
  if (!run) {
    return jsonResponse({ error: "No sync run to stop" }, 400);
  }

  const leadsInDb = await countBatchLeads();
  const { data } = await supabase
    .from("inventory_sync_runs")
    .update({
      status: "stopped",
      completed_at: new Date().toISOString(),
      leads_upserted: leadsInDb,
      error_message: "Stopped by user",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .in("status", ["running", "partial", "paused"])
    .select("*")
    .single();

  if (!data) {
    return jsonResponse({ error: "Could not stop sync" }, 409);
  }

  return jsonResponse({ ok: true, run: data, leadsInDb });
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);

  let body: {
    action?: string;
    mode?: SyncMode;
    startPage?: number;
    maxPages?: number;
    runId?: string;
    background?: boolean;
    force?: boolean;
    _internalContinue?: boolean;
  } = {};

  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const internal = isInternalContinue(req, body);
  const scheduled = isScheduledTrigger(req, body);
  if (!internal && !scheduled) {
    const ceoId = await requireCeo(req);
    if (!ceoId) {
      return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
    }
  }

  // ─── GET ───────────────────────────────────────────────────────────────────

  if (req.method === "GET") {
    if (url.searchParams.get("list") === "1") {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const source = url.searchParams.get("source") ?? "Batch";

      const { data: runs, count } = await supabase
        .from("inventory_sync_runs")
        .select("*", { count: "exact" })
        .eq("source", source)
        .order("started_at", { ascending: false })
        .range(offset, offset + limit - 1);

      return jsonResponse({
        runs: runs ?? [],
        total: count ?? 0,
        limit,
        offset,
      });
    }

    let { data: lastRun } = await supabase
      .from("inventory_sync_runs")
      .select("*")
      .eq("source", "Batch")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    lastRun = await reconcileStaleRun(lastRun);
    const leadsInDb = await countBatchLeads();

    let batchConnected = false;
    try {
      await loadBatchLeadsCredentials(supabase, decrypt);
      batchConnected = true;
    } catch {
      batchConnected = false;
    }

    const watermark = await getIncrementalWatermark();

    return jsonResponse({
      batchConnected,
      lastRun,
      hasIncrementalBaseline: watermark !== null,
      ...runFlags(lastRun, leadsInDb),
    });
  }

  // ─── POST ──────────────────────────────────────────────────────────────────

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (internal) {
    const status = await getRunStatus(String(body.runId));
    if (status !== "running") {
      return jsonResponse({ skipped: true, reason: status ?? "not_found" });
    }
  }

  if (body.action === "pause") {
    return handlePause(body.runId);
  }

  if (body.action === "stop") {
    return handleStop(body.runId);
  }

  const controlActions = new Set(["sync", "resume"]);
  if (body.action && !controlActions.has(body.action)) {
    return jsonResponse({ error: "Unknown action" }, 400);
  }

  const requestedMode: SyncMode = body.mode === "incremental" ? "incremental" : "full";
  const maxPages = Math.min(50, Math.max(1, Number(body.maxPages ?? DEFAULT_MAX_PAGES_PER_RUN)));
  const continueInBackground = body.background !== false;

  let startPage = Math.max(1, Number(body.startPage ?? 1));
  let runId = body.runId;
  let runRow: Record<string, unknown> | null = null;
  let syncMode: SyncMode = requestedMode;
  let incrementalSince: string | null = null;

  // ─── Resolve watermark for incremental ─────────────────────────────────────

  if (requestedMode === "incremental" && body.action !== "resume") {
    incrementalSince = await getIncrementalWatermark();
    if (!incrementalSince) {
      return jsonResponse(
        { error: "Run a Full refresh first to establish a baseline before using Incremental sync." },
        400,
      );
    }
  }

  // ─── Resume existing run ────────────────────────────────────────────────────

  if (body.action === "resume" || (runId && !body.force)) {
    if (!runId) {
      const { data: latest } = await supabase
        .from("inventory_sync_runs")
        .select("*")
        .eq("source", "Batch")
        .in("status", ["running", "partial", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      runRow = latest;
      runId = latest?.id as string | undefined;
    } else {
      const { data } = await supabase
        .from("inventory_sync_runs")
        .select("*")
        .eq("id", runId)
        .single();
      runRow = data;
    }

    if (!runRow || !runId || !RESUMABLE_STATUSES.has(String(runRow.status))) {
      if (body.action === "resume") {
        return jsonResponse({ error: "No sync run to resume" }, 400);
      }
      runRow = null;
      runId = undefined;
    } else if (runRow.status === "stopped") {
      return jsonResponse({ error: "This sync was stopped. Start a new sync instead." }, 400);
    } else {
      const meta = (runRow.metadata ?? {}) as RunMeta;
      if (meta.nextPage) startPage = meta.nextPage;
      syncMode = meta.mode ?? "full";
      if (syncMode === "incremental") {
        incrementalSince = meta.since ?? null;
      }
      await supabase
        .from("inventory_sync_runs")
        .update({ status: "running", error_message: null, updated_at: new Date().toISOString() })
        .eq("id", runId);
      runRow.status = "running";
    }
  }

  // ─── Create new run ─────────────────────────────────────────────────────────

  if (!runId) {
    const { data: active } = await supabase
      .from("inventory_sync_runs")
      .select("id, status, metadata")
      .eq("source", "Batch")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active && !body.force) {
      const meta = (active.metadata ?? {}) as RunMeta;
      runId = active.id;
      if (meta.nextPage) startPage = meta.nextPage;
    } else {
      const { data: blocked } = await supabase
        .from("inventory_sync_runs")
        .select("id, status")
        .eq("source", "Batch")
        .in("status", ["running", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (blocked && !body.force) {
        return jsonResponse({
          error: blocked.status === "paused"
            ? "A sync is paused. Resume or stop it before starting a new one."
            : "A sync is already running.",
          runId: blocked.id,
        }, 409);
      }

      const { data, error } = await supabase
        .from("inventory_sync_runs")
        .insert({
          source: "Batch",
          status: "running",
          metadata: {
            startPage,
            maxPages,
            mode: syncMode,
            since: incrementalSince,
            cumulativeNew: 0,
            cumulativeUpdated: 0,
            pagesProcessedTotal: 0,
          },
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error || !data) {
        return jsonResponse({ error: "Failed to start sync run" }, 500);
      }
      runId = data.id;
      runRow = data;
    }
  }

  if (runId && !runRow) {
    const { data } = await supabase
      .from("inventory_sync_runs")
      .select("*")
      .eq("id", runId)
      .single();
    runRow = data;
    if (!runRow || !RESUMABLE_STATUSES.has(String(runRow.status))) {
      return jsonResponse({ error: "Sync run not found or already finished" }, 400);
    }
    const meta = (runRow.metadata ?? {}) as RunMeta;
    if (meta.nextPage && !body.startPage) startPage = meta.nextPage;
    syncMode = meta.mode ?? syncMode;
    if (syncMode === "incremental" && meta.since) incrementalSince = meta.since;
  }

  // ─── Carry forward cumulative stats from previous chunks ───────────────────

  const prevMeta = (runRow?.metadata ?? {}) as RunMeta;
  let cumulativeNew = prevMeta.cumulativeNew ?? 0;
  let cumulativeUpdated = prevMeta.cumulativeUpdated ?? 0;
  let pagesProcessedTotal = prevMeta.pagesProcessedTotal ?? 0;
  let filteredEquity = prevMeta.filteredEquity ?? 0;
  let filteredFiling = prevMeta.filteredFiling ?? 0;
  let filteredApn = prevMeta.filteredApn ?? 0;
  let qualifiedTotal = prevMeta.qualifiedTotal ?? 0;
  let leadsAutoAssigned = prevMeta.leadsAutoAssigned ?? 0;

  // ─── Round-robin setup (once per invocation) ───────────────────────────────

  const repIds = await loadActiveRepIds(supabase);
  const assignmentSkippedNoReps = repIds.length === 0;
  let rrIndex = assignmentSkippedNoReps ? 0 : await loadRoundRobinIndex(supabase);

  // ─── Sync loop ─────────────────────────────────────────────────────────────

  const started = Date.now();
  let pagesProcessed = 0;
  let lastPage = startPage - 1;
  let totalAvailable = 0;
  let completed = false;
  // Per-chunk counters (reset each background invocation)
  let chunkNew = 0;
  let chunkUpdated = 0;

  try {
    const { integrationId, credentialId, credentials } = await loadBatchLeadsCredentials(
      supabase,
      decrypt,
    );

    const seen = new Set<string>();
    let page = startPage;

    for (let i = 0; i < maxPages; i++) {
      const currentStatus = await getRunStatus(runId!);
      if (currentStatus === "paused") {
        const leadsInDb = await countBatchLeads();
        await supabase
          .from("inventory_sync_runs")
          .update({ leads_upserted: leadsInDb, updated_at: new Date().toISOString() })
          .eq("id", runId);
        return jsonResponse({
          runId,
          paused: true,
          leadsInDb,
          pagesProcessed,
          lastPage,
          totalAvailable,
          completed: false,
          nextPage: lastPage + 1,
          durationMs: Date.now() - started,
        });
      }
      if (currentStatus === "stopped") {
        const leadsInDb = await countBatchLeads();
        return jsonResponse({
          runId,
          stopped: true,
          leadsInDb,
          pagesProcessed,
          durationMs: Date.now() - started,
        });
      }
      if (currentStatus !== "running") {
        return jsonResponse({ skipped: true, reason: currentStatus });
      }

      const pageResult = await fetchSavedAddressesPage(credentials, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        listIds: [],
        mode: syncMode,
        updatedSince: incrementalSince ?? undefined,
      });

      await logBatchApiCall(
        supabase,
        integrationId,
        credentialId,
        "POST",
        "/api/v1/property",
        200,
        0,
      );

      totalAvailable = pageResult.meta.total;
      lastPage = page;
      pagesProcessed++;
      pagesProcessedTotal++;

      const qualified: ReturnType<typeof mapBatchRowToInventoryLead>[] = [];
      const seenApnInPage = new Set<string>();
      for (const row of pageResult.rows) {
        const mapped = mapBatchRowToInventoryLead(row);
        if (seen.has(mapped.external_id)) continue;
        seen.add(mapped.external_id);

        const reason = disqualifyReason(mapped);
        if (reason === "equity") { filteredEquity++; continue; }
        if (reason === "filing") { filteredFiling++; continue; }

        // Within-page APN dedup: drop second occurrences of the same APN
        if (mapped.apn) {
          if (seenApnInPage.has(mapped.apn)) { filteredApn++; continue; }
          seenApnInPage.add(mapped.apn);
        }

        qualified.push(mapped);
      }

      // Cross-batch APN dedup: skip leads whose APN already exists in the
      // inventory with an active status (different external_id but same APN
      // = same physical property re-listed under a new Batch row).
      let rowsToUpsert = qualified;
      const apnList = qualified.map((r) => r.apn).filter((v): v is string => !!v);
      if (apnList.length > 0) {
        const { data: existingApns } = await supabase
          .from("inventory_leads")
          .select("apn, external_id")
          .eq("source", "Batch")
          .in("apn", apnList)
          .in("status", ["New", "Contacted", "Promoted"]);

        if (existingApns && existingApns.length > 0) {
          const existingByApn = new Map<string, string>();
          for (const r of existingApns as Array<{ apn: string; external_id: string }>) {
            existingByApn.set(r.apn, r.external_id);
          }
          rowsToUpsert = qualified.filter((r) => {
            if (!r.apn) return true;
            const owner = existingByApn.get(r.apn);
            // Allow upsert if the existing row IS this same external_id (regular update).
            if (!owner || owner === r.external_id) return true;
            filteredApn++;
            return false;
          });
        }
      }

      qualifiedTotal += rowsToUpsert.length;

      if (rowsToUpsert.length > 0) {
        // Determine which rows are new vs already in the DB, and whether
        // existing rows already have a rep assigned (so we never overwrite).
        const externalIds = rowsToUpsert.map((r) => r.external_id);
        const { data: existingRows } = await supabase
          .from("inventory_leads")
          .select("external_id, assigned_rep_id")
          .eq("source", "Batch")
          .in("external_id", externalIds);

        const existingMap = new Map<string, string | null>(
          (existingRows ?? []).map(
            (r: { external_id: string; assigned_rep_id: string | null }) => [
              r.external_id,
              r.assigned_rep_id,
            ],
          ),
        );

        // Partition and assign reps
        const toInsert: ReturnType<typeof buildInsertRow>[] = [];
        const toUpdate: ReturnType<typeof buildUpdateRow>[] = [];

        for (const row of rowsToUpsert) {
          const isNew = !existingMap.has(row.external_id);
          const currentRep = existingMap.get(row.external_id) ?? null;
          const needsAssignment = isNew || currentRep === null;

          let assignedRepId: string | null = null;
          if (needsAssignment && !assignmentSkippedNoReps) {
            const { assignments, nextIndex } = assignRepsRoundRobin(repIds, rrIndex, 1);
            assignedRepId = assignments[0];
            rrIndex = nextIndex;
            leadsAutoAssigned++;
          }

          if (isNew) {
            toInsert.push(buildInsertRow(row, assignedRepId));
          } else {
            // Only pass assignedRepId when we are filling an empty slot
            toUpdate.push(
              buildUpdateRow(row, needsAssignment ? { assignedRepId } : {}),
            );
          }
        }

        const pageNew = toInsert.length;
        const pageUpdated = toUpdate.length;
        chunkNew += pageNew;
        chunkUpdated += pageUpdated;
        cumulativeNew += pageNew;
        cumulativeUpdated += pageUpdated;

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("inventory_leads")
            .insert(toInsert);
          if (insertErr) throw new Error(insertErr.message);
        }

        if (toUpdate.length > 0) {
          // Upsert with minimal fields; onConflict falls into UPDATE path for
          // existing rows, leaving untouched columns (status, contact_attempts,
          // ingested_at, last_contact_date, last_outcome) unchanged.
          const { error: updateErr } = await supabase
            .from("inventory_leads")
            .upsert(toUpdate, { onConflict: "source,external_id" });
          if (updateErr) throw new Error(updateErr.message);
        }

        // Persist cursor after every page so background chunks stay fair.
        if (!assignmentSkippedNoReps) {
          await saveRoundRobinIndex(supabase, rrIndex, repIds.length);
        }
      }

      const isLastPage = page >= pageResult.meta.last_page || pageResult.rows.length === 0;
      if (isLastPage) {
        completed = true;
        break;
      }

      page++;
      await sleep(200);
    }

    const leadsInDb = await countBatchLeads();
    const nextPage = completed ? null : lastPage + 1;
    const metadata: RunMeta = {
      startPage: prevMeta.startPage ?? startPage,
      maxPages,
      lastPage,
      nextPage,
      totalAvailable,
      pagesProcessedTotal,
      completed,
      mode: syncMode,
      since: incrementalSince,
      cumulativeNew,
      cumulativeUpdated,
      filteredEquity,
      filteredFiling,
      filteredApn,
      qualifiedTotal,
      leadsAutoAssigned,
      assignmentSkippedNoReps: assignmentSkippedNoReps || undefined,
      roundRobinRepCount: repIds.length || undefined,
    };

    const finalStatus = await getRunStatus(runId!);
    if (finalStatus === "paused" || finalStatus === "stopped") {
      return jsonResponse({
        runId,
        paused: finalStatus === "paused",
        stopped: finalStatus === "stopped",
        leadsInDb,
        pagesProcessed,
        durationMs: Date.now() - started,
      });
    }

    await supabase
      .from("inventory_sync_runs")
      .update({
        status: completed ? "success" : "running",
        completed_at: completed ? new Date().toISOString() : null,
        lists_processed: 1,
        leads_upserted: leadsInDb,
        metadata,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (!completed && nextPage != null && continueInBackground) {
      const afterUpdate = await getRunStatus(runId!);
      if (afterUpdate === "running") {
        scheduleBackgroundContinue(runId!, nextPage, maxPages);
      }
    }

    return jsonResponse({
      runId,
      mode: syncMode,
      // leadsInDb = total Batch leads in database (not "upserted this run")
      leadsInDb,
      // Per-chunk counts (this background invocation only)
      chunkNew,
      chunkUpdated,
      // Cumulative counts across all chunks of this run
      cumulativeNew,
      cumulativeUpdated,
      // Ingest-time filter counters
      filteredEquity,
      filteredFiling,
      filteredApn,
      qualifiedTotal,
      // Round-robin assignment
      leadsAutoAssigned,
      assignmentSkippedNoReps: assignmentSkippedNoReps || undefined,
      roundRobinRepCount: repIds.length || undefined,
      pagesProcessed,
      pagesProcessedTotal,
      lastPage,
      totalAvailable,
      completed,
      nextPage,
      backgroundContinuing: !completed && continueInBackground,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const leadsInDb = await countBatchLeads();
    const meta = (runRow?.metadata ?? {}) as RunMeta;

    await supabase
      .from("inventory_sync_runs")
      .update({
        status: meta.nextPage ? "partial" : "failed",
        completed_at: new Date().toISOString(),
        leads_upserted: leadsInDb,
        error_message: message,
        metadata: {
          ...meta,
          lastPage,
          totalAvailable,
          nextPage: meta.nextPage ?? null,
          completed: false,
          cumulativeNew,
          cumulativeUpdated,
          pagesProcessedTotal,
          filteredEquity,
          filteredFiling,
          filteredApn,
          qualifiedTotal,
          leadsAutoAssigned,
          assignmentSkippedNoReps: assignmentSkippedNoReps || undefined,
          roundRobinRepCount: repIds.length || undefined,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return jsonResponse({ error: message, runId, canResume: !!meta.nextPage }, 500);
  }
});
