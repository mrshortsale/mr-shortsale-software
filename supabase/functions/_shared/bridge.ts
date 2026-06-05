/**
 * Shared Bridge Data Output helpers.
 * Used by bridge-mls-sync, integrations-manage (test/discover), and bridge-mls-cron.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "./crypto.ts";

export const BRIDGE_DEFAULT_BASE = "https://api.bridgedataoutput.com";
export const BRIDGE_ZILLOW_SLUG = "zillow";
export const BRIDGE_MAX_PAGE_SIZE = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BridgeCredentials {
  integrationId: string;
  credentialId: string;
  apiKey: string;
  baseUrl: string;
}

// RESO-standard OData Property fields returned by Bridge
export interface BridgeProperty {
  ListingId?: string;
  BridgeModificationTimestamp?: string;
  ListAgentKey?: string;
  ListAgentFullName?: string;
  ListOfficeName?: string;
  ListAgentDirectPhone?: string;
  ListAgentEmail?: string;
  UnparsedAddress?: string;
  City?: string;
  StateOrProvince?: string;
  ListPrice?: number;
  DaysOnMarket?: number;
  PriceChangeTimestamp?: string;
  PublicRemarks?: string;
  SpecialListingConditions?: string;
  [key: string]: unknown;
}

export interface BridgeODataResponse {
  value?: BridgeProperty[];
  bundle?: BridgeProperty[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

export interface BridgeDataset {
  id: string;
  name: string;
  recordCount?: number;
}

// Shape stored in bridge_mls_sync_profiles (just what we need here)
export interface MlsSyncProfile {
  id: string;
  integration_id: string;
  dataset_id: string;
  display_name: string;
  enabled: boolean;
  state_allowlist: string[];
  keyword_filters: string[];
  condition_filters: string[];
  odata_filter_override: string | null;
  select_fields: string[];
  page_size: number;
  sort_order: string;
  last_synced_at: string | null;
}

// What we map each property into before upsert
export interface AgentLeadRow {
  profile_id: string;
  dataset_id: string;
  external_id: string;
  list_agent_key: string | null;
  agent_name: string;
  brokerage: string;
  agent_phone: string;
  agent_email: string;
  language: "EN" | "ES";
  listing_count: number;
  latest_listing_id: string;
  latest_property_address: string;
  latest_city: string;
  latest_state: string;
  latest_list_price: number;
  latest_days_on_market: number;
  latest_public_remarks: string;
}

// ─── Credential loading ───────────────────────────────────────────────────────

export async function loadBridgeCredentials(
  supabase: SupabaseClient,
): Promise<{ credentials: BridgeCredentials; error: string | null }> {
  const { data: integration, error: intErr } = await supabase
    .from("integrations")
    .select("id, default_base_url")
    .eq("slug", BRIDGE_ZILLOW_SLUG)
    .single();

  if (intErr || !integration) {
    return { credentials: null as unknown as BridgeCredentials, error: "Zillow integration not found" };
  }

  const { data: cred, error: credErr } = await supabase
    .from("integration_credentials")
    .select("id, status, encrypted_credentials, credentials_iv, base_url")
    .eq("integration_id", integration.id)
    .single();

  if (credErr || !cred) {
    return { credentials: null as unknown as BridgeCredentials, error: "Zillow credentials not configured" };
  }

  if (cred.status !== "connected") {
    return { credentials: null as unknown as BridgeCredentials, error: "Zillow integration is not connected" };
  }

  let apiKey = "";
  try {
    const decrypted = JSON.parse(
      await decrypt(cred.encrypted_credentials, cred.credentials_iv),
    ) as Record<string, string>;
    apiKey = decrypted.apiKey || decrypted.api_key || "";
  } catch {
    return { credentials: null as unknown as BridgeCredentials, error: "Failed to decrypt Bridge credentials" };
  }

  if (!apiKey) {
    return { credentials: null as unknown as BridgeCredentials, error: "No API key stored for Bridge / Zillow" };
  }

  const baseUrl = (cred.base_url || integration.default_base_url || BRIDGE_DEFAULT_BASE)
    .replace(/\/+$/, "");

  return {
    credentials: { integrationId: integration.id, credentialId: cred.id, apiKey, baseUrl },
    error: null,
  };
}

// ─── OData filter builder ─────────────────────────────────────────────────────

/**
 * Build an OData $filter string for a profile.
 * If odata_filter_override is set, use it verbatim (incremental watermark
 * is NOT appended automatically — document this to CEO).
 */
export function buildODataFilter(
  profile: Pick<MlsSyncProfile, "keyword_filters" | "condition_filters" | "state_allowlist" | "odata_filter_override">,
  since?: string,
): string {
  if (profile.odata_filter_override) {
    return profile.odata_filter_override;
  }

  const parts: string[] = [];

  // Keyword clauses — Bridge OData does NOT support tolower(); use plain contains() (case-sensitive on the API side)
  if (profile.keyword_filters.length > 0) {
    const kwClauses = profile.keyword_filters.map(
      (kw) => `contains(PublicRemarks,'${kw.replace(/'/g, "''")}')`,
    );
    parts.push(`(${kwClauses.join(" or ")})`);
  }

  // Special listing condition clauses
  if (profile.condition_filters.length > 0) {
    const condClauses = profile.condition_filters.map(
      (c) => `contains(SpecialListingConditions,'${c.replace(/'/g, "''")}')`,
    );
    parts.push(`(${condClauses.join(" or ")})`);
  }

  // Combine keyword + conditions with OR
  const distressedFilter = parts.length > 0 ? parts.join(" or ") : null;

  const allParts: string[] = [];
  if (distressedFilter) allParts.push(`(${distressedFilter})`);

  // State allowlist — use explicit eq clauses joined with or (Bridge OData may not support the 'in' operator)
  if (profile.state_allowlist.length > 0) {
    const stateClauses = profile.state_allowlist
      .map((s) => `StateOrProvince eq '${s.replace(/'/g, "''")}'`)
      .join(" or ");
    allParts.push(
      profile.state_allowlist.length === 1
        ? stateClauses
        : `(${stateClauses})`,
    );
  }

  // Incremental watermark (only in preset mode)
  if (since) {
    allParts.push(`BridgeModificationTimestamp gt ${since}`);
  }

  return allParts.length > 0 ? allParts.join(" and ") : "DaysOnMarket gt 0";
}

// ─── URL builder ─────────────────────────────────────────────────────────────

export function buildPropertyUrl(params: {
  baseUrl: string;
  datasetId: string;
  apiKey: string;
  filter: string;
  select?: string[];  // omit to let Bridge return all available fields
  top: number;
  skip?: number;
  orderBy: string;
}): string {
  const { baseUrl, datasetId, apiKey, filter, select, top, skip, orderBy } = params;
  const url = new URL(`${baseUrl}/api/v2/OData/${datasetId}/Property`);
  // Bridge accepts both Bearer header and access_token query param; use both for compatibility
  url.searchParams.set("access_token", apiKey);
  url.searchParams.set("$filter", filter);
  // Only add $select if explicitly provided — omitting it avoids 400s on datasets
  // that don't expose every field in our default list
  if (select && select.length > 0) {
    url.searchParams.set("$select", select.join(","));
  }
  url.searchParams.set("$top", String(top));
  if (skip != null && skip > 0) url.searchParams.set("$skip", String(skip));
  if (orderBy) url.searchParams.set("$orderby", orderBy);
  return url.toString();
}

// ─── Fetch one page ───────────────────────────────────────────────────────────

export interface FetchPageResult {
  properties: BridgeProperty[];
  nextLink: string | null;
  totalCount: number | null;
  statusCode: number;
  latencyMs: number;
  error: string | null;
}

export async function fetchPropertyPage(
  url: string,
  apiKey: string,
  timeoutMs = 20000,
): Promise<FetchPageResult> {
  const startTime = Date.now();
  let statusCode = 200;
  let error: string | null = null;
  let properties: BridgeProperty[] = [];
  let nextLink: string | null = null;
  let totalCount: number | null = null;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    statusCode = response.status;
    if (response.ok) {
      const data = await response.json() as BridgeODataResponse;
      properties = data.value ?? data.bundle ?? [];
      nextLink = data["@odata.nextLink"] ?? null;
      totalCount = data["@odata.count"] ?? null;
    } else {
      // Include Bridge's error body in the message so we can diagnose OData issues
      let bodyText = "";
      try { bodyText = await response.text(); } catch { /* ignore */ }
      const snippet = bodyText.slice(0, 300);
      error = `HTTP ${response.status}: ${response.statusText}${snippet ? " — " + snippet : ""}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Network error";
    statusCode = 0;
  }

  return { properties, nextLink, totalCount, statusCode, latencyMs: Date.now() - startTime, error };
}

// ─── API call logger ──────────────────────────────────────────────────────────

export async function logBridgeApiCall(
  supabase: SupabaseClient,
  creds: BridgeCredentials,
  params: {
    endpoint: string;
    statusCode: number;
    latencyMs: number;
    errorMessage: string | null;
  },
): Promise<void> {
  await supabase.from("integration_api_logs").insert({
    integration_id: creds.integrationId,
    credential_id: creds.credentialId,
    method: "GET",
    endpoint: params.endpoint,
    status_code: params.statusCode,
    latency_ms: params.latencyMs,
    error_message: params.errorMessage,
    direction: "outbound",
  });
}

// ─── Dataset discovery ────────────────────────────────────────────────────────

export async function discoverDatasets(
  baseUrl: string,
  apiKey: string,
): Promise<{ datasets: BridgeDataset[]; error: string | null }> {
  try {
    const url = `${baseUrl}/api/v2/datasets?access_token=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { datasets: [], error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const raw = await response.json() as { bundle?: unknown[]; datasets?: unknown[] };
    const items: unknown[] = raw.bundle ?? raw.datasets ?? [];
    const datasets: BridgeDataset[] = items.map((item) => {
      const d = item as Record<string, unknown>;
      return {
        id: String(d.dataset_id ?? d.id ?? ""),
        name: String(d.name ?? d.dataset_name ?? d.id ?? ""),
        recordCount: typeof d.count === "number" ? d.count : undefined,
      };
    });
    return { datasets, error: null };
  } catch (err) {
    return { datasets: [], error: err instanceof Error ? err.message : "Network error" };
  }
}

// ─── Profile tester (one page $top=1) ────────────────────────────────────────

export async function testMlsProfile(
  profile: MlsSyncProfile,
  creds: BridgeCredentials,
): Promise<{ success: boolean; latencyMs: number; sample: BridgeProperty | null; error: string | null; debug?: Record<string, unknown> }> {
  const filter = buildODataFilter(profile);
  // No $select — let Bridge return all available fields for this dataset
  const url = buildPropertyUrl({
    baseUrl: creds.baseUrl,
    datasetId: profile.dataset_id,
    apiKey: creds.apiKey,
    filter,
    top: 1,
    orderBy: profile.sort_order,
  });

  const result = await fetchPropertyPage(url, creds.apiKey, 10000);
  // Redact the access_token from the debug URL before returning
  const debugUrl = url.replace(/access_token=[^&]+/, "access_token=REDACTED");
  return {
    success: result.error === null,
    latencyMs: result.latencyMs,
    sample: result.properties[0] ?? null,
    error: result.error,
    debug: { filter, url: debugUrl, statusCode: result.statusCode },
  };
}

// ─── Agent lead mapper ────────────────────────────────────────────────────────

/**
 * Derive a stable external_id for (dataset, agent).
 * Prefer ListAgentKey; fall back to a deterministic hash of name+office.
 */
export function agentExternalId(datasetId: string, prop: BridgeProperty): string {
  const key = prop.ListAgentKey?.trim();
  if (key) return `${datasetId}:${key}`;
  // Fallback: slugify name+office
  const slug = `${prop.ListAgentFullName ?? ""}|${prop.ListOfficeName ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-|]/g, "")
    .slice(0, 80);
  return `${datasetId}:anon-${slug}`;
}

export function detectLanguage(prop: BridgeProperty): "EN" | "ES" {
  const text = `${prop.PublicRemarks ?? ""} ${prop.ListAgentFullName ?? ""}`.toLowerCase();
  return text.includes("venta") || text.includes("corta") || text.includes("banco") ? "ES" : "EN";
}

export function mapPropertyToAgentLead(
  prop: BridgeProperty,
  profile: MlsSyncProfile,
): AgentLeadRow {
  const externalId = agentExternalId(profile.dataset_id, prop);
  return {
    profile_id: profile.id,
    dataset_id: profile.dataset_id,
    external_id: externalId,
    list_agent_key: prop.ListAgentKey ?? null,
    agent_name: prop.ListAgentFullName?.trim() || "Unknown Agent",
    brokerage: prop.ListOfficeName?.trim() || "",
    // Phone/email field names vary by dataset — try both RESO and Bridge-specific names
    agent_phone: (prop.ListAgentDirectPhone ?? prop.ListAgentOfficePhone ?? prop.ListAgentPreferredPhone ?? "")?.toString().trim() || "",
    agent_email: (prop.ListAgentEmail ?? prop.ListAgentEmailAddress ?? "")?.toString().trim() || "",
    language: detectLanguage(prop),
    listing_count: 1,
    latest_listing_id: prop.ListingId || "",
    latest_property_address: prop.UnparsedAddress || "",
    latest_city: prop.City || "",
    latest_state: prop.StateOrProvince || "",
    latest_list_price: prop.ListPrice ?? 0,
    // DaysOnMarket field name varies — some datasets use CumulativeDaysOnMarket
    latest_days_on_market: prop.DaysOnMarket ?? prop.CumulativeDaysOnMarket ?? prop.DaysOnMarketCumulative ?? 0,
    latest_public_remarks: (prop.PublicRemarks || "").slice(0, 500),
  };
}
