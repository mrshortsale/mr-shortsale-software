/**
 * realtor-leads
 *
 * Read/update API for mls_agent_leads (agent-primary realtor short-sale pipeline).
 *
 * GET  → list + stats
 * PATCH → update status, notes, last_contact_at
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

async function requireUser(req: Request): Promise<{ id: string; role: string } | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (!["ceo", "rep"].includes(payload.role)) return null;
    const { data } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", payload.sub)
      .single();
    if (!data || !data.is_active) return null;
    return { id: data.id, role: data.role };
  } catch {
    return null;
  }
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function rowToAgent(row: Record<string, unknown>) {
  return {
    id: row.id,
    profileId: row.profile_id,
    datasetId: row.dataset_id,
    externalId: row.external_id,
    listAgentKey: row.list_agent_key,
    agentName: row.agent_name,
    brokerage: row.brokerage,
    agentPhone: row.agent_phone,
    agentEmail: row.agent_email,
    language: row.language,
    listingCount: row.listing_count,
    latestListingId: row.latest_listing_id,
    latestPropertyAddress: row.latest_property_address,
    latestCity: row.latest_city,
    latestState: row.latest_state,
    latestListPrice: row.latest_list_price,
    latestDaysOnMarket: row.latest_days_on_market,
    latestPublicRemarks: row.latest_public_remarks,
    status: row.status,
    assignedRep: row.assigned_rep ?? null,
    lastContactAt: row.last_contact_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const user = await requireUser(req);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 403);

  // ── PATCH: update workflow fields ──────────────────────────────────────────
  if (req.method === "PATCH") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { id, status, notes, lastContactAt, assignedRep } = body as {
      id?: string;
      status?: string;
      notes?: string;
      lastContactAt?: string | null;
      assignedRep?: string | null;
    };

    if (!id) return jsonResponse({ error: "id is required" }, 400);

    const validStatuses = ["New", "Contacted", "Partnered", "Closed Won", "Declined"];
    if (status && !validStatuses.includes(status)) {
      return jsonResponse({ error: `status must be one of: ${validStatuses.join(", ")}` }, 400);
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (lastContactAt !== undefined) updates.last_contact_at = lastContactAt;
    if (assignedRep !== undefined) updates.assigned_rep = assignedRep || null;

    if (Object.keys(updates).length === 0) return jsonResponse({ error: "No fields to update" }, 400);

    const { data, error: updateErr } = await supabase
      .from("mls_agent_leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !data) return jsonResponse({ error: "Failed to update realtor lead" }, 500);
    return jsonResponse({ lead: rowToAgent(data as Record<string, unknown>) });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── GET: list with filters + stats ────────────────────────────────────────
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profile_id");
  const datasetId = url.searchParams.get("dataset_id");
  const state = url.searchParams.get("state");
  const language = url.searchParams.get("language");
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter((s) =>
        ["New", "Contacted", "Partnered", "Closed Won", "Declined"].includes(s)
      )
    : [];
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const hotOnly = url.searchParams.get("hot_only") === "true";

  // Build filtered query
  let query = supabase
    .from("mls_agent_leads")
    .select("*", { count: "exact" })
    .order("latest_days_on_market", { ascending: false })
    .range(offset, offset + limit - 1);

  if (profileId) query = query.eq("profile_id", profileId);
  if (datasetId) query = query.eq("dataset_id", datasetId);
  if (state) query = query.eq("latest_state", state);
  if (language) query = query.eq("language", language);
  if (statuses.length > 0) query = query.in("status", statuses);
  if (hotOnly) {
    // Hot = 2+ listings OR 90+ days on market
    query = query.or("listing_count.gte.2,latest_days_on_market.gte.90");
  }
  if (q) {
    query = query.or(
      `agent_name.ilike.%${q}%,brokerage.ilike.%${q}%,latest_property_address.ilike.%${q}%`,
    );
  }

  const { data: leads, count, error: listErr } = await query;
  if (listErr) return jsonResponse({ error: "Failed to fetch realtor leads" }, 500);

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const today = startOfTodayIso();

  const [statsTotal, statsNew, statsHot, statsContacted, statsLastSync] = await Promise.all([
    supabase.from("mls_agent_leads").select("*", { count: "exact", head: true }),
    supabase.from("mls_agent_leads").select("*", { count: "exact", head: true })
      .eq("status", "New")
      .gte("created_at", today),
    supabase.from("mls_agent_leads").select("*", { count: "exact", head: true })
      .or("listing_count.gte.2,latest_days_on_market.gte.90"),
    supabase.from("mls_agent_leads").select("*", { count: "exact", head: true })
      .eq("status", "Contacted"),
    supabase.from("realtor_sync_runs")
      .select("completed_at")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = {
    total: statsTotal.count ?? 0,
    newToday: statsNew.count ?? 0,
    hotLeads: statsHot.count ?? 0,
    awaitingFollowup: statsContacted.count ?? 0,
    lastSyncAt: statsLastSync.data?.completed_at ?? null,
  };

  return jsonResponse({
    leads: (leads ?? []).map((r) => rowToAgent(r as Record<string, unknown>)),
    total: count ?? 0,
    stats,
  });
});
