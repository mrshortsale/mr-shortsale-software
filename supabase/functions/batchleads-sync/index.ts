import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";
import {
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_PAGE_SIZE,
  fetchSavedAddressesPage,
  loadBatchLeadsCredentials,
  logBatchApiCall,
  mapBatchRowToInventoryLead,
} from "../_shared/batchleads.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const STALE_RUN_MS = 3 * 60 * 1000;
const RESUMABLE_STATUSES = new Set(["running", "partial"]);

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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return !!serviceKey && bearerToken(req) === serviceKey;
}

async function countBatchLeads(): Promise<number> {
  const { count } = await supabase
    .from("inventory_leads")
    .select("*", { count: "exact", head: true })
    .eq("source", "Batch");
  return count ?? 0;
}

async function reconcileStaleRun(
  run: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!run || run.status !== "running") return run;

  const updatedAt = run.updated_at
    ? new Date(String(run.updated_at)).getTime()
    : new Date(String(run.started_at)).getTime();
  if (Date.now() - updatedAt < STALE_RUN_MS) return run;

  const meta = (run.metadata ?? {}) as { nextPage?: number; completed?: boolean };
  if (meta.completed || meta.nextPage == null) return run;

  const batchCount = await countBatchLeads();
  const { data } = await supabase
    .from("inventory_sync_runs")
    .update({
      status: "partial",
      leads_upserted: batchCount,
      error_message: "Sync paused — resume to fetch remaining leads",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();

  return data ?? { ...run, status: "partial", leads_upserted: batchCount };
}

function scheduleBackgroundContinue(
  runId: string,
  startPage: number,
  maxPages: number,
): void {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/batchleads-sync`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let body: {
    action?: string;
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
  if (!internal) {
    const ceoId = await requireCeo(req);
    if (!ceoId) {
      return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
    }
  }

  if (req.method === "GET") {
    let { data: lastRun } = await supabase
      .from("inventory_sync_runs")
      .select("*")
      .eq("source", "Batch")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    lastRun = await reconcileStaleRun(lastRun);

    const batchLeadCount = await countBatchLeads();

    let batchConnected = false;
    try {
      await loadBatchLeadsCredentials(supabase, decrypt);
      batchConnected = true;
    } catch {
      batchConnected = false;
    }

    const meta = (lastRun?.metadata ?? {}) as {
      completed?: boolean;
      nextPage?: number | null;
      totalAvailable?: number;
    };

    return jsonResponse({
      batchConnected,
      lastRun,
      batchLeadCount,
      syncInProgress: lastRun?.status === "running",
      canResume: lastRun != null && RESUMABLE_STATUSES.has(String(lastRun.status)),
      progress: lastRun
        ? {
            completed: meta.completed === true || lastRun.status === "success",
            nextPage: meta.nextPage ?? null,
            totalAvailable: meta.totalAvailable ?? null,
            leadsInDb: batchLeadCount,
          }
        : null,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (body.action && body.action !== "sync" && body.action !== "resume") {
    return jsonResponse({ error: "Unknown action" }, 400);
  }

  const maxPages = Math.min(50, Math.max(1, Number(body.maxPages ?? DEFAULT_MAX_PAGES_PER_RUN)));
  const continueInBackground = body.background !== false;

  let startPage = Math.max(1, Number(body.startPage ?? 1));
  let runId = body.runId;
  let runRow: Record<string, unknown> | null = null;

  if (body.action === "resume" || (runId && !body.force)) {
    if (!runId) {
      const { data: latest } = await supabase
        .from("inventory_sync_runs")
        .select("*")
        .eq("source", "Batch")
        .in("status", ["running", "partial"])
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
    } else {
      const meta = (runRow.metadata ?? {}) as { nextPage?: number };
      if (meta.nextPage) startPage = meta.nextPage;
      await supabase
        .from("inventory_sync_runs")
        .update({ status: "running", error_message: null, updated_at: new Date().toISOString() })
        .eq("id", runId);
      runRow.status = "running";
    }
  }

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
      const meta = (active.metadata ?? {}) as { nextPage?: number };
      runId = active.id;
      if (meta.nextPage) startPage = meta.nextPage;
    } else {
      const { data, error } = await supabase
        .from("inventory_sync_runs")
        .insert({
          source: "Batch",
          status: "running",
          metadata: { startPage, maxPages },
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
    const meta = (runRow.metadata ?? {}) as { nextPage?: number };
    if (meta.nextPage && !body.startPage) startPage = meta.nextPage;
  }

  const started = Date.now();
  let pagesProcessed = 0;
  let lastPage = startPage - 1;
  let totalAvailable = 0;
  let completed = false;

  try {
    const { integrationId, credentialId, credentials } = await loadBatchLeadsCredentials(
      supabase,
      decrypt,
    );

    const seen = new Set<string>();
    let page = startPage;

    for (let i = 0; i < maxPages; i++) {
      const pageResult = await fetchSavedAddressesPage(credentials, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        listIds: [],
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

      const batchRows = [];
      for (const row of pageResult.rows) {
        const mapped = mapBatchRowToInventoryLead(row);
        if (seen.has(mapped.external_id)) continue;
        seen.add(mapped.external_id);
        batchRows.push(mapped);
      }

      if (batchRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("inventory_leads")
          .upsert(batchRows, { onConflict: "source,external_id" });

        if (upsertErr) throw new Error(upsertErr.message);
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
    const metadata = {
      startPage,
      maxPages,
      lastPage,
      nextPage,
      totalAvailable,
      pagesProcessedThisRun: pagesProcessed,
      completed,
    };

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
      scheduleBackgroundContinue(runId!, nextPage, maxPages);
    }

    return jsonResponse({
      runId,
      leadsUpserted: leadsInDb,
      pagesProcessed,
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
    const meta = (runRow?.metadata ?? {}) as { nextPage?: number };

    await supabase
      .from("inventory_sync_runs")
      .update({
        status: meta.nextPage ? "partial" : "failed",
        completed_at: new Date().toISOString(),
        leads_upserted: leadsInDb,
        error_message: message,
        metadata: {
          startPage,
          maxPages,
          lastPage,
          totalAvailable,
          nextPage: meta.nextPage ?? null,
          completed: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return jsonResponse({ error: message, runId, canResume: !!meta.nextPage }, 500);
  }
});
