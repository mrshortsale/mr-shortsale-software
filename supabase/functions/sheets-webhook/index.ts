/**
 * sheets-webhook
 *
 * Inbound webhook for Google Sheets leads posted by Zapier.
 * POST { tab, lead_id, ...fields }
 * → optionally validates X-Webhook-Secret when SHEETS_WEBHOOK_SECRET is set
 * → upserts into inventory_leads (source = GoogleSheets)
 * → round-robin assigns new leads to active sales reps
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  assignRepsRoundRobin,
  GOOGLE_SHEETS_SCOPE,
  loadAssignableRepIds,
  loadRoundRobinIndex,
  saveRoundRobinIndex,
} from "../_shared/roundRobin.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const DEFAULT_TAB = "AD Leads";

const VALID_TABS = new Set([
  "AD Leads",
  "Spanish Leads",
  "New Campaign Leads",
  "Updated Leads",
  "realtors",
]);

interface SheetsLeadPayload {
  tab?: string;
  lead_id?: string;
  received_at?: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  campaign_name?: string;
  adset_name?: string;
  creative?: string;
  form_type?: string;
  intent?: string;
  platform?: string;
  is_duplicate?: boolean;
  [key: string]: unknown;
}

function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ fn: "sheets-webhook", event, ts: new Date().toISOString(), ...data }));
}

function logError(event: string, data: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ fn: "sheets-webhook", event, level: "error", ts: new Date().toISOString(), ...data }));
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function slugifyTab(tab: string): string {
  return tab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildLeadId(tab: string, leadId: string): string {
  return `sheets-${slugifyTab(tab)}-${sanitizeIdPart(leadId)}`;
}

function parseReceivedAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function verifyWebhookSecret(req: Request): boolean {
  const expected = Deno.env.get("SHEETS_WEBHOOK_SECRET")?.trim();
  if (!expected) {
    log("auth_skipped", { reason: "SHEETS_WEBHOOK_SECRET not configured" });
    return true;
  }
  const provided = req.headers.get("x-webhook-secret");
  const ok = provided === expected;
  log(ok ? "auth_ok" : "auth_failed", { hasHeader: Boolean(provided) });
  return ok;
}

function resolveTab(body: SheetsLeadPayload): { tab: string; warnings: string[] } {
  const raw = typeof body.tab === "string" ? body.tab.trim() : "";
  if (raw && VALID_TABS.has(raw)) return { tab: raw, warnings: [] };
  if (raw) {
    return {
      tab: DEFAULT_TAB,
      warnings: [`Unknown tab "${raw}", defaulting to "${DEFAULT_TAB}"`],
    };
  }
  return {
    tab: DEFAULT_TAB,
    warnings: [`tab missing, defaulting to "${DEFAULT_TAB}" — add tab field in Zapier`],
  };
}

function resolveLeadId(body: SheetsLeadPayload): { leadId: string; warnings: string[] } {
  const raw = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  if (raw) return { leadId: raw, warnings: [] };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const name = typeof body.name === "string" ? body.name.trim().toLowerCase().replace(/\s+/g, "-") : "";
  const seed = [email, phone, name].filter(Boolean).join("_") || `row_${Date.now()}`;
  return {
    leadId: `auto-${sanitizeIdPart(seed).slice(0, 64)}`,
    warnings: ["lead_id missing, generated fallback id — add lead_id field in Zapier for stable dedup"],
  };
}

async function processLead(
  body: SheetsLeadPayload,
): Promise<{ id: string; assigned: boolean; updated: boolean; warnings: string[] }> {
  const tabResult = resolveTab(body);
  const leadIdResult = resolveLeadId(body);
  const tab = tabResult.tab;
  const leadId = leadIdResult.leadId;
  const warnings = [...tabResult.warnings, ...leadIdResult.warnings];

  log("process_lead_start", {
    tab,
    leadId,
    hasName: Boolean(body.name),
    hasPhone: Boolean(body.phone),
    hasEmail: Boolean(body.email),
    hasAddress: Boolean(body.address),
    warnings,
  });

  const owner = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const campaignName = typeof body.campaign_name === "string" ? body.campaign_name.trim() : "";
  const leadType = tab === "realtors" ? "Realtor" : "Inbound";
  const language = tab === "Spanish Leads" ? "ES" : "EN";

  // Dedup key is UNIQUE (source, external_id), not the tab-prefixed primary id.
  const { data: existing, error: lookupErr } = await supabase
    .from("inventory_leads")
    .select("id, assigned_rep_id, status, received_at")
    .eq("source", "GoogleSheets")
    .eq("external_id", leadId)
    .maybeSingle();

  if (lookupErr) {
    logError("lookup_failed", { leadId, message: lookupErr.message });
    throw new Error(`Lookup failed: ${lookupErr.message}`);
  }

  const id = (existing as { id: string } | null)?.id ?? buildLeadId(tab, leadId);
  const updated = Boolean(existing);
  log("lookup_result", { id, leadId, exists: updated });

  let assignedRepId: string | null =
    (existing as { assigned_rep_id: string | null } | null)?.assigned_rep_id ?? null;
  let assigned = false;
  const existingStatus =
    (existing as { status: string } | null)?.status ?? "New";
  const existingReceivedAt =
    (existing as { received_at: string } | null)?.received_at ?? null;

  if (!existing) {
    const repIds = await loadAssignableRepIds(supabase);
    log("round_robin_reps", { repCount: repIds.length });
    if (repIds.length > 0) {
      let rrIndex = await loadRoundRobinIndex(supabase, GOOGLE_SHEETS_SCOPE);
      const { assignments, nextIndex } = assignRepsRoundRobin(repIds, rrIndex, 1);
      assignedRepId = assignments[0];
      rrIndex = nextIndex;
      await saveRoundRobinIndex(supabase, rrIndex, repIds.length, GOOGLE_SHEETS_SCOPE);
      assigned = true;
      log("round_robin_assigned", { id, assignedRepId });
    } else {
      log("round_robin_skipped", { reason: "no active reps" });
      warnings.push("No active sales reps — lead saved unassigned");
    }
  }

  const row = {
    id,
    source: "GoogleSheets",
    external_id: leadId,
    data_source: tab,
    data_source_primary: campaignName || null,
    owner: owner || "Unknown",
    address: address || "",
    city: city || "",
    state: state || "",
    county: "",
    phone: phone || null,
    email: email || null,
    equity_pct: 0,
    days_to_auction: 999,
    score: 5,
    language,
    status: existingStatus,
    filing_type: "Inbound",
    lead_type: leadType,
    received_at: existingReceivedAt ?? parseReceivedAt(body.received_at),
    ingested_at: new Date().toISOString(),
    assigned_rep_id: assignedRepId,
    raw_payload: body,
  };

  const { error } = await supabase
    .from("inventory_leads")
    .upsert(row, { onConflict: "source,external_id" });

  if (error) {
    logError("upsert_failed", { id, leadId, message: error.message, code: error.code });
    throw new Error(`Upsert failed: ${error.message}`);
  }

  log("upsert_ok", { id, tab, owner: owner || "Unknown", assigned, updated, assignedRepId });

  return { id, assigned, updated, warnings };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startedAt = Date.now();

  if (req.method !== "POST") {
    log("method_not_allowed", { method: req.method });
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let rawBody = "";
  let body: SheetsLeadPayload = {};
  try {
    rawBody = await req.text();
    body = rawBody ? JSON.parse(rawBody) as SheetsLeadPayload : {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    logError("parse_failed", { message, bodyPreview: rawBody.slice(0, 500) });
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  log("request_received", {
    contentType: req.headers.get("content-type"),
    bodyBytes: rawBody.length,
    keys: Object.keys(body),
    tab: body.tab ?? null,
    lead_id: body.lead_id ?? null,
    name: body.name ?? null,
  });

  try {
    const result = await processLead(body);
    const latencyMs = Date.now() - startedAt;
    log("request_ok", { id: result.id, assigned: result.assigned, latencyMs, warnings: result.warnings });

    return jsonResponse({
      received: true,
      id: result.id,
      assigned: result.assigned,
      updated: result.updated,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      warning: result.warnings[0],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const latencyMs = Date.now() - startedAt;
    logError("request_failed", { message, latencyMs, keys: Object.keys(body) });
    return jsonResponse({ received: false, error: message }, 500);
  }
});
