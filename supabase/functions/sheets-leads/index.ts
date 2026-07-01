/**
 * sheets-leads
 *
 * Read API for Google Sheets speed-to-lead leads stored in inventory_leads.
 *
 * GET ?tab=AD+Leads&limit=50        → list leads for a tab (or all tabs)
 * GET ?action=metrics               → today's counts grouped by data_source tab
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { assignUnassignedGoogleSheetLeadsRoundRobin } from "../_shared/roundRobin.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const SHEET_TABS = [
  "AD Leads",
  "New Campaign Leads",
  "Updated Leads",
  "realtors",
] as const;

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

function rowToSheetLead(
  row: Record<string, unknown>,
  repNames: Map<string, string>,
) {
  const raw = (row.raw_payload ?? {}) as Record<string, unknown>;
  const assignedRepId = row.assigned_rep_id ? String(row.assigned_rep_id) : null;
  return {
    id: row.id,
    tab: row.data_source,
    leadId: row.external_id,
    owner: row.owner,
    phone: row.phone ?? null,
    email: row.email ?? null,
    city: row.city ?? "",
    state: row.state ?? "",
    address: row.address ?? "",
    campaignName: row.data_source_primary ?? raw.campaign_name ?? null,
    adsetName: raw.adset_name ?? null,
    creative: raw.creative ?? null,
    formType: raw.form_type ?? null,
    intent: raw.intent ?? null,
    platform: raw.platform ?? null,
    leadType: row.lead_type ?? "Inbound",
    status: row.status,
    assignedRepId,
    assignedRepName: assignedRepId ? repNames.get(assignedRepId) ?? null : null,
    receivedAt: new Date(String(row.received_at)).getTime(),
    ingestedAt: row.ingested_at ? new Date(String(row.ingested_at)).getTime() : null,
  };
}

async function loadRepNames(repIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (repIds.length === 0) return map;

  const { data } = await supabase
    .from("users")
    .select("id, name")
    .in("id", repIds);

  for (const rep of data ?? []) {
    map.set((rep as { id: string }).id, (rep as { name: string }).name);
  }
  return map;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const user = await requireUser(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 403);
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "list";
    const todayIso = startOfTodayIso();

    if (action === "metrics") {
      const counts: Record<string, number> = {};
      for (const tab of SHEET_TABS) {
        counts[tab] = 0;
      }

      const { data, error } = await supabase
        .from("inventory_leads")
        .select("data_source")
        .eq("source", "GoogleSheets")
        .gte("received_at", todayIso);

      if (error) {
        return jsonResponse({ error: "Failed to load metrics" }, 500);
      }

      for (const row of data ?? []) {
        const tab = String((row as { data_source: string | null }).data_source ?? "");
        if (tab in counts) counts[tab]++;
      }

      const totalToday = Object.values(counts).reduce((sum, n) => sum + n, 0);

      return jsonResponse({
        counts,
        totalToday,
        tabs: SHEET_TABS,
      });
    }

    // Backfill round-robin for any leads ingested before reps existed.
    await assignUnassignedGoogleSheetLeadsRoundRobin(supabase);

    const tab = url.searchParams.get("tab");
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
    const sinceRaw = url.searchParams.get("since");
    const sinceMs = sinceRaw ? Number(sinceRaw) : null;

    let query = supabase
      .from("inventory_leads")
      .select("*")
      .eq("source", "GoogleSheets")
      .neq("status", "Dismissed")
      .order("received_at", { ascending: false })
      .limit(limit);

    if (tab && tab !== "all") {
      query = query.eq("data_source", tab);
    }

    if (sinceMs !== null && Number.isFinite(sinceMs) && sinceMs > 0) {
      query = query.gt("received_at", new Date(sinceMs).toISOString());
    }

    const { data: rows, error } = await query;
    if (error) {
      return jsonResponse({ error: "Failed to fetch sheet leads" }, 500);
    }

    const repIds = [
      ...new Set(
        (rows ?? [])
          .map((r) => (r as { assigned_rep_id: string | null }).assigned_rep_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const repNames = await loadRepNames(repIds);
    const leads = (rows ?? []).map((r) => rowToSheetLead(r as Record<string, unknown>, repNames));

    return jsonResponse({ leads, tabs: SHEET_TABS });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
