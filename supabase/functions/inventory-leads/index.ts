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
  };
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
  const triageOnly = url.searchParams.get("triage_only") === "true";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  let query = supabase
    .from("inventory_leads")
    .select("*", { count: "exact" })
    .eq("source", source)
    .order("score", { ascending: false })
    .order("days_to_auction", { ascending: true })
    .range(offset, offset + limit - 1);

  if (state && state !== "All") {
    query = query.eq("state", state);
  }
  if (esOnly) {
    query = query.eq("language", "ES");
  }
  if (triageOnly) {
    const floor = Math.max(0, minScore);
    query = query.or(`score.gte.${floor},days_to_auction.lte.30`);
  } else if (minScore > 0) {
    query = query.gte("score", minScore);
  }
  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    const pattern = `%${escaped}%`;
    query = query.or(
      `owner.ilike."${pattern}",address.ilike."${pattern}",county.ilike."${pattern}",city.ilike."${pattern}"`,
    );
  }

  const { data: rows, error, count } = await query;
  if (error) {
    return jsonResponse({ error: "Failed to fetch inventory leads" }, 500);
  }

  const leads = (rows ?? []).map((r) => rowToLead(r as Record<string, unknown>));

  const { count: batchCount } = await supabase
    .from("inventory_leads")
    .select("*", { count: "exact", head: true })
    .eq("source", "Batch");

  const { data: hotRows } = await supabase
    .from("inventory_leads")
    .select("id")
    .eq("source", source)
    .gte("score", 8)
    .limit(5000);

  const { data: triageRows } = await supabase
    .from("inventory_leads")
    .select("id")
    .eq("source", source)
    .or("score.gte.7,days_to_auction.lte.30")
    .limit(5000);

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
      total: batchCount ?? 0,
      hot: hotRows?.length ?? 0,
      triage: triageRows?.length ?? 0,
      bySource: {
        Batch: batchCount ?? 0,
        Zillow: 0,
        Meta: 0,
        Manual: 0,
      },
    },
    lastSync: lastRun,
  });
});
