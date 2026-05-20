import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const BATCH_LEADS_DEFAULT_BASE = "https://app.batchleads.io";
export const BATCH_LEADS_PROPERTY_PATH = "/api/v1/property";
export const BATCH_LEADS_LISTS_PATH = "/api/v1/lists";
export const DEFAULT_PAGE_SIZE = 100;
/** Pages per edge invocation — keep small so each chunk finishes under function limits and heartbeats stay fresh. */
export const DEFAULT_MAX_PAGES_PER_RUN = 5;

export interface BatchLeadsCredentials {
  apiKey: string;
  baseUrl: string;
}

export interface BatchPropertyRow {
  id: number | string;
  mailing_first_name?: string | null;
  mailing_last_name?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_county?: string | null;
  property_zip?: string | null;
  estimated_value?: number | null;
  equity_current_estimated_balance?: number | null;
  batchrank_score_category?: string | null;
  created_date?: string | null;
  updated_date?: string | null;
  apn?: string | null;
  assessor_parcel_number?: string | null;
  phone_numbers?: Array<string | { number?: string | null; phone?: string | null }> | null;
  phones?: Array<string | { number?: string | null; phone?: string | null }> | null;
  phone1?: string | null;
  email?: string | null;
  emails?: Array<string | { email?: string | null; address?: string | null }> | null;
  foreclosure_data?: {
    auctionDate?: string | null;
    recordingDate?: string | null;
    defaultDate?: string | null;
    nodDate?: string | null;
    nodRecordingDate?: string | null;
    nodFilingDate?: string | null;
    noticeOfDefaultDate?: string | null;
    noticeOfTrusteeSaleDate?: string | null;
    ntsRecordingDate?: string | null;
    ntsFilingDate?: string | null;
    lispendensDate?: string | null;
    lisPendensDate?: string | null;
    lisPendensFilingDate?: string | null;
    filingType?: string | null;
    documentType?: string | null;
  } | null;
  list_ids?: number[] | null;
  lists_data?: unknown;
  [key: string]: unknown;
}

export interface BatchPropertyPage {
  rows: BatchPropertyRow[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export function getApiKey(creds: Record<string, string>): string | undefined {
  const raw = creds.apiKey || creds.api_key || creds["api-key"];
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || undefined;
}

export function normalizeBaseUrl(url: string | undefined | null): string {
  const trimmed = (url || BATCH_LEADS_DEFAULT_BASE).trim().replace(/\/+$/, "");
  return trimmed.replace(/\/api\/v1\/?.*$/i, "") || BATCH_LEADS_DEFAULT_BASE;
}

export type SyncMode = "full" | "incremental";

export function buildPropertyRequestBody(options: {
  page: number;
  pageSize?: number;
  listIds?: number[];
  mode?: SyncMode;
  /**
   * ISO watermark for incremental mode. Batch API accepts `added_date` as "YYYY-MM-DD"
   * to return only leads added on or after that date. The time portion is dropped.
   */
  updatedSince?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    list_id: options.listIds ?? [],
    list_id2: [],
    lead_status: [1],
    camp_cond_filter: "includeAny",
    camp_cond_filter_dontinclude: "dontincludeAny",
    camp_from: 1,
    camp_to: 999,
    mailer1: [],
    mailer2: [],
    mailer_cond_filter: "includeAny",
    mailer_cond_filter_dontinclude: "dontincludeAny",
    mailer_from: "0",
    mailer_to: "999",
    pagesize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    sort_data: "id",
    sort_type: "asc",
    page: options.page,
    status: 0,
    ids: [],
    action: 1,
    uncheckedids: [],
    lead_score_from: 0,
    lead_score_to: 100,
    is_vacant: "No",
    is_mailing_vacant: "No",
    absentee: "No",
    skiptraced: "",
    opt_out: "both",
    self_managed: "both",
    has_phone_numbers: "1",
    ui_version: 2,
  };

  // Incremental: pass added_date as YYYY-MM-DD so Batch filters server-side.
  // This returns only leads added on/after the watermark date — meta.total will be
  // the count of genuinely new leads, not the full 70k.
  if (options.mode === "incremental" && options.updatedSince) {
    body.added_date = options.updatedSince.slice(0, 10);
  }

  return body;
}

export async function batchFetch(
  baseUrl: string,
  path: string,
  apiKey: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<{ statusCode: number; json: Record<string, unknown>; latencyMs: number }> {
  const started = Date.now();
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { errors: text || "Invalid JSON response" };
  }
  return { statusCode: res.status, json, latencyMs: Date.now() - started };
}

export async function logBatchApiCall(
  supabase: SupabaseClient,
  integrationId: string,
  credentialId: string | null,
  method: string,
  endpoint: string,
  statusCode: number | null,
  latencyMs: number,
  errorMessage?: string | null,
): Promise<void> {
  await supabase.from("integration_api_logs").insert({
    integration_id: integrationId,
    credential_id: credentialId,
    method,
    endpoint,
    status_code: statusCode,
    latency_ms: latencyMs,
    error_message: errorMessage ?? null,
    direction: "outbound",
  });
}

export async function fetchLists(
  creds: BatchLeadsCredentials,
): Promise<{ id: number; list_name: string }[]> {
  const { json } = await batchFetch(creds.baseUrl, BATCH_LEADS_LISTS_PATH, creds.apiKey);
  if (json.status !== 1) {
    throw new Error(String(json.errors ?? json.message ?? "Failed to fetch Batch Leads lists"));
  }
  const data = json.data;
  if (!Array.isArray(data)) return [];
  return data as { id: number; list_name: string }[];
}

export async function fetchSavedAddressesPage(
  creds: BatchLeadsCredentials,
  options: { page: number; pageSize?: number; listIds?: number[]; mode?: SyncMode; updatedSince?: string },
): Promise<BatchPropertyPage> {
  const body = buildPropertyRequestBody(options);
  const { statusCode, json } = await batchFetch(
    creds.baseUrl,
    BATCH_LEADS_PROPERTY_PATH,
    creds.apiKey,
    { method: "POST", body },
  );

  if (statusCode >= 400 || json.errors) {
    throw new Error(String(json.errors ?? json.message ?? `Batch Leads property fetch failed (${statusCode})`));
  }

  const envelope = json.data as Record<string, unknown> | undefined;
  const rows = Array.isArray(envelope?.data) ? envelope.data as BatchPropertyRow[] : [];
  const meta = (envelope?.meta ?? {}) as BatchPropertyPage["meta"];

  return {
    rows,
    meta: {
      current_page: Number(meta.current_page ?? options.page),
      last_page: Number(meta.last_page ?? options.page),
      per_page: Number(meta.per_page ?? options.pageSize ?? DEFAULT_PAGE_SIZE),
      total: Number(meta.total ?? rows.length),
    },
  };
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function daysUntil(dateStr: string | null | undefined): number {
  const ms = parseDateMs(dateStr);
  if (ms === null) return 999;
  return Math.max(0, Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24)));
}

function scoreFromCategory(category: string | null | undefined): number {
  const map: Record<string, number> = {
    High: 9,
    Medium: 6,
    Low: 4,
    Unknown: 5,
  };
  if (!category) return 5;
  return map[category] ?? 5;
}

function deriveScore(equityPct: number, daysToAuction: number, category?: string | null): number {
  const base = scoreFromCategory(category);
  let score = base;
  if (equityPct <= 15) score += 1;
  if (daysToAuction <= 30) score += 2;
  else if (daysToAuction <= 90) score += 1;
  return Math.min(10, Math.max(1, score));
}

function inferLanguage(first?: string | null, last?: string | null): "EN" | "ES" {
  const name = `${first ?? ""} ${last ?? ""}`.toLowerCase();
  const esHints = ["maria", "jose", "carlos", "rosa", "miguel", "ana", "luis", "juan", "garcia", "lopez", "martinez", "rodriguez"];
  return esHints.some((h) => name.includes(h)) ? "ES" : "EN";
}

function pickFirstString(values: Array<unknown>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const candidates = ["number", "phone", "email", "address", "value"];
      for (const key of candidates) {
        const inner = obj[key];
        if (typeof inner === "string" && inner.trim()) return inner.trim();
      }
    }
  }
  return null;
}

function extractPhone(row: BatchPropertyRow): string | null {
  const fromArray = pickFirstString([...(row.phone_numbers ?? []), ...(row.phones ?? [])]);
  if (fromArray) return fromArray;
  if (typeof row.phone1 === "string" && row.phone1.trim()) return row.phone1.trim();
  return null;
}

function extractEmail(row: BatchPropertyRow): string | null {
  if (typeof row.email === "string" && row.email.trim()) return row.email.trim();
  return pickFirstString(row.emails ?? []);
}

function extractApn(row: BatchPropertyRow): string | null {
  const candidates = [row.apn, row.assessor_parcel_number, (row as Record<string, unknown>)["parcel_number"]];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number") return String(c);
  }
  return null;
}

/**
 * Derive filing type from Batch foreclosure_data. We support multiple field
 * shapes since Batch's exact payload varies; the spec only requires NOD/NTS/LP
 * to qualify, so anything else (or null) will be filtered out at ingest.
 */
function deriveFilingType(row: BatchPropertyRow): "NOD" | "NTS" | "LP" | "Other" | null {
  const f = row.foreclosure_data ?? null;
  if (!f) return null;

  const explicit = (f.filingType || f.documentType || "").toString().toLowerCase();
  if (explicit) {
    if (explicit.includes("default") || explicit === "nod") return "NOD";
    if (explicit.includes("trustee") || explicit.includes("notice of sale") || explicit === "nts") return "NTS";
    if (explicit.includes("lis pendens") || explicit === "lp") return "LP";
    return "Other";
  }

  if (f.nodDate || f.nodRecordingDate || f.nodFilingDate || f.defaultDate || f.noticeOfDefaultDate) {
    return "NOD";
  }
  if (f.noticeOfTrusteeSaleDate || f.ntsRecordingDate || f.ntsFilingDate || f.auctionDate) {
    return "NTS";
  }
  if (f.lispendensDate || f.lisPendensDate || f.lisPendensFilingDate) {
    return "LP";
  }
  return null;
}

/**
 * Normalize a property address for cross-source dedup. Uppercases, strips
 * punctuation/extra whitespace, and appends the 5-digit ZIP when available.
 * Not used for filtering yet but populated for future use.
 */
export function normalizeAddress(address?: string | null, zip?: string | null): string | null {
  const a = (address ?? "").toString().trim().toUpperCase();
  if (!a) return null;
  const cleaned = a.replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  const zip5 = (zip ?? "").toString().match(/\d{5}/)?.[0] ?? null;
  return zip5 ? `${cleaned} ${zip5}` : cleaned;
}

export function mapBatchRowToInventoryLead(
  row: BatchPropertyRow,
  listMeta?: { batch_list_id?: number | null; batch_list_name?: string | null },
) {
  const externalId = String(row.id);
  const estimated = Number(row.estimated_value ?? 0);
  const equityBalance = Number(row.equity_current_estimated_balance ?? 0);
  let equityPct = 0;
  let ltvPct: number | null = null;
  if (estimated > 0 && equityBalance >= 0) {
    equityPct = Math.round((equityBalance / estimated) * 100);
    ltvPct = Math.max(0, Math.min(100, Math.round((1 - equityBalance / estimated) * 100)));
  }
  equityPct = Math.min(100, Math.max(0, equityPct));

  const auctionDate = row.foreclosure_data?.auctionDate ?? null;
  const daysToAuction = daysUntil(auctionDate);
  const score = deriveScore(equityPct, daysToAuction, row.batchrank_score_category as string | undefined);
  const owner = [row.mailing_first_name, row.mailing_last_name].filter(Boolean).join(" ").trim() || "Unknown Owner";
  const receivedAt = row.created_date ?? row.updated_date ?? new Date().toISOString();
  const nowIso = new Date().toISOString();
  const address = (row.property_address ?? (row as Record<string, unknown>)["property_line_1"] ?? "") as string;

  return {
    id: `batch-${externalId}`,
    source: "Batch",
    external_id: externalId,
    batch_list_id: listMeta?.batch_list_id ?? null,
    batch_list_name: listMeta?.batch_list_name ?? null,
    owner,
    address,
    city: row.property_city ?? "",
    state: row.property_state ?? "",
    county: row.property_county ?? "",
    equity_pct: equityPct,
    days_to_auction: daysToAuction,
    score,
    language: inferLanguage(row.mailing_first_name, row.mailing_last_name),
    status: "New",
    received_at: receivedAt,
    raw_payload: row,
    synced_at: nowIso,
    apn: extractApn(row),
    phone: extractPhone(row),
    email: extractEmail(row),
    filing_type: deriveFilingType(row),
    lead_type: "Homeowner",
    ingested_at: nowIso,
    ltv_pct: ltvPct,
    contact_attempts: 0,
    normalized_address: normalizeAddress(address, row.property_zip),
  };
}

export type MappedInventoryLead = ReturnType<typeof mapBatchRowToInventoryLead>;

// ─── Insert / update payload helpers ────────────────────────────────────────

/**
 * Fields from a mapped lead that are safe to overwrite on every sync run.
 * These reflect fresh data from Batch (property details, scores, contact info).
 * Workflow fields (status, contact_attempts, assigned_rep_id, etc.) are
 * deliberately excluded so re-syncs never clobber rep work.
 */
export const SYNC_UPDATE_FIELDS = [
  "batch_list_id",
  "batch_list_name",
  "owner",
  "address",
  "city",
  "state",
  "county",
  "equity_pct",
  "ltv_pct",
  "days_to_auction",
  "score",
  "language",
  "raw_payload",
  "synced_at",
  "apn",
  "phone",
  "email",
  "filing_type",
  "normalized_address",
  "received_at",
] as const;

type SyncUpdateField = (typeof SYNC_UPDATE_FIELDS)[number];

/**
 * Full row for a brand-new lead insert, including the auto-assigned rep.
 */
export function buildInsertRow(
  mapped: MappedInventoryLead,
  assignedRepId: string | null,
): MappedInventoryLead & { assigned_rep_id: string | null } {
  return { ...mapped, assigned_rep_id: assignedRepId };
}

/**
 * Minimal update payload for a lead that already exists in the DB.
 * Only sync-safe fields are included; `assigned_rep_id` is added only when the
 * caller is filling in a previously empty slot (not overwriting an existing rep).
 */
export function buildUpdateRow(
  mapped: MappedInventoryLead,
  opts: { assignedRepId?: string | null } = {},
): Pick<MappedInventoryLead, "id" | "source" | "external_id"> &
  Pick<MappedInventoryLead, SyncUpdateField> & { assigned_rep_id?: string | null } {
  const row: Record<string, unknown> = {
    id: mapped.id,
    source: mapped.source,
    external_id: mapped.external_id,
  };
  for (const f of SYNC_UPDATE_FIELDS) {
    row[f] = mapped[f];
  }
  if ("assignedRepId" in opts) {
    row["assigned_rep_id"] = opts.assignedRepId;
  }
  return row as ReturnType<typeof buildUpdateRow>;
}

/**
 * Apply ingest-time qualification rules to a mapped Batch lead.
 * Returns null if the lead passes, otherwise a string describing the reason
 * it was filtered out (useful for run-level counters).
 */
export function disqualifyReason(lead: MappedInventoryLead): "equity" | "filing" | null {
  if (lead.equity_pct > 25) return "equity";
  if (!lead.filing_type || !["NOD", "NTS", "LP"].includes(lead.filing_type)) return "filing";
  return null;
}

export async function loadBatchLeadsCredentials(
  supabase: SupabaseClient,
  decryptFn: (cipher: string, iv: string) => Promise<string>,
): Promise<{
  integrationId: string;
  credentialId: string;
  credentials: BatchLeadsCredentials;
}> {
  const { data: integration, error: intErr } = await supabase
    .from("integrations")
    .select("id, slug, default_base_url")
    .eq("slug", "batchleads")
    .single();

  if (intErr || !integration) {
    throw new Error("Batch Leads integration is not configured");
  }

  const { data: cred, error: credErr } = await supabase
    .from("integration_credentials")
    .select("*")
    .eq("integration_id", integration.id)
    .eq("status", "connected")
    .single();

  if (credErr || !cred) {
    throw new Error("Batch Leads is not connected. Configure it under Integrations first.");
  }

  const decrypted = await decryptFn(cred.encrypted_credentials, cred.credentials_iv);
  const parsed = JSON.parse(decrypted) as Record<string, string>;
  delete parsed._baseUrl;

  const apiKey = getApiKey(parsed);
  if (!apiKey) {
    throw new Error("No Batch Leads API key stored");
  }

  return {
    integrationId: integration.id,
    credentialId: cred.id,
    credentials: {
      apiKey,
      baseUrl: normalizeBaseUrl(cred.base_url || integration.default_base_url),
    },
  };
}
