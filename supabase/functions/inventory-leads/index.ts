import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

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

function rowToLead(row: Record<string, unknown>) {
  const ingestedAt = row.ingested_at ? new Date(String(row.ingested_at)).getTime() : null;
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    batchListName: row.batch_list_name,
    owner: row.owner,
    address: row.address,
    city: row.city,
    state: row.state,
    county: row.county,
    equityPct: row.equity_pct,
    daysToAuction: row.days_to_auction,
    score: row.score,
    language: row.language,
    receivedAt: new Date(String(row.received_at)).getTime(),
    status: row.status,
    apn: row.apn ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    filingType: row.filing_type ?? null,
    leadType: row.lead_type ?? "Homeowner",
    ltvPct: row.ltv_pct ?? null,
    assignedRepId: row.assigned_rep_id ?? null,
    contactAttempts: row.contact_attempts ?? 0,
    lastContactDate: row.last_contact_date ? new Date(String(row.last_contact_date)).getTime() : null,
    lastOutcome: row.last_outcome ?? null,
    ingestedAt,
  };
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "Batch";
  const state = url.searchParams.get("state");
  const q = url.searchParams.get("q")?.trim();
  const minScore = Number(url.searchParams.get("min_score") ?? "0");
  const esOnly = url.searchParams.get("es_only") === "true";
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter((s) => ["New", "Contacted", "Promoted", "Dismissed"].includes(s))
    : [];
  const filingTypeParam = url.searchParams.get("filing_type");
  const filingTypes = filingTypeParam
    ? filingTypeParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const assignedRep = url.searchParams.get("assigned_rep");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  // Build the main paged query for the table
  // deno-lint-ignore no-explicit-any
  const applyFilters = (qb: any) => {
    qb = qb.eq("source", source);
    if (state && state !== "All") qb = qb.eq("state", state);
    if (esOnly) qb = qb.eq("language", "ES");
    if (statuses.length > 0) {
      qb = qb.in("status", statuses);
    } else {
      // Default: hide Dismissed in the table view unless explicitly requested
      qb = qb.neq("status", "Dismissed");
    }
    if (filingTypes.length > 0) qb = qb.in("filing_type", filingTypes);
    if (assignedRep === "unassigned") qb = qb.is("assigned_rep_id", null);
    else if (assignedRep) qb = qb.eq("assigned_rep_id", assignedRep);
    if (minScore > 0) qb = qb.gte("score", minScore);
    if (q) {
      const escaped = q.replace(/[%_,]/g, "");
      const pattern = `%${escaped}%`;
      qb = qb.or(
        `owner.ilike."${pattern}",address.ilike."${pattern}",county.ilike."${pattern}",city.ilike."${pattern}"`,
      );
    }
    return qb;
  };

  let query = supabase
    .from("inventory_leads")
    .select("*", { count: "exact" })
    .order("score", { ascending: false })
    .order("days_to_auction", { ascending: true })
    .range(offset, offset + limit - 1);
  query = applyFilters(query);

  const { data: rows, error, count } = await query;
  if (error) {
    return jsonResponse({ error: "Failed to fetch inventory leads" }, 500);
  }

  const leads = (rows ?? []).map((r) => rowToLead(r as Record<string, unknown>));

  // KPI counters scoped to the active source. Each is a HEAD count query.
  const todayIso = startOfTodayIso();

  const kpiBase = () =>
    supabase.from("inventory_leads").select("*", { count: "exact", head: true }).eq("source", source);

  const [newTodayResp, hotEquityResp, auctionsLt30Resp, hotScoreResp, totalSourceResp] = await Promise.all([
    kpiBase().gte("ingested_at", todayIso),
    kpiBase().gte("equity_pct", 75),
    kpiBase().lt("days_to_auction", 30).neq("status", "Dismissed"),
    kpiBase().gte("score", 8).neq("status", "Dismissed"),
    kpiBase(),
  ]);

  // Avg contact attempts requires a small aggregation; do it with a single
  // .select() and compute client-side, capped at 5000 active rows (KPI is a
  // headline metric, exact value isn't critical).
  const { data: attemptsRows } = await supabase
    .from("inventory_leads")
    .select("contact_attempts")
    .eq("source", source)
    .in("status", ["New", "Contacted"])
    .limit(5000);
  const attemptsArr = (attemptsRows ?? []).map((r: { contact_attempts: number | null }) =>
    Number(r.contact_attempts ?? 0)
  );
  const avgAttempts = attemptsArr.length > 0
    ? Math.round((attemptsArr.reduce((a, b) => a + b, 0) / attemptsArr.length) * 10) / 10
    : 0;

  const { data: lastRun } = await supabase
    .from("inventory_sync_runs")
    .select("*")
    .eq("source", "Batch")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const total = count ?? leads.length;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return jsonResponse({
    leads,
    total,
    page,
    pageSize: limit,
    totalPages,
    stats: {
      // Funnel banner numerator/denominator
      sourceTotal: totalSourceResp.count ?? 0,
      // 5 spec KPIs
      newToday: newTodayResp.count ?? 0,
      avgAttempts,
      hotEquity: hotEquityResp.count ?? 0,
      auctionsLt30: auctionsLt30Resp.count ?? 0,
      hotScore: hotScoreResp.count ?? 0,
      bySource: {
        Batch: totalSourceResp.count ?? 0,
        Zillow: 0,
        Meta: 0,
        Manual: 0,
      },
    },
    lastSync: lastRun,
  });
});
