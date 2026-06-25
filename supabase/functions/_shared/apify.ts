/**
 * Shared Apify API client helpers.
 * Used by zillow-apify-sync, zillow-apify-manage, and auction-apify-sync.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "./crypto.ts";

export const APIFY_BASE = "https://api.apify.com/v2";

// Actor IDs that ship as defaults in the integration seed.
// The CEO can override them via the UI once credentials are configured.
export const DEFAULT_SEARCH_ACTOR_ID = "X46xKaa20oUA1fRiP";
export const DEFAULT_AGENT_ACTOR_ID = "1NT8sDVAgchUDnHOc";
export const DEFAULT_AUCTION_ACTOR_ID = "parseforge/auction-com-property-scraper";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApifyCredentials {
  integrationId: string;
  credentialId: string;
  apiToken: string;
  searchActorId: string;
  agentActorId: string;
}

/** Minimal shape of items returned by the Zillow Search Scraper. */
export interface ZillowSearchItem {
  zpid?: string | number;
  detailUrl?: string;
  address?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZipcode?: string;
  price?: number | string;
  unformattedPrice?: number;
  daysOnZillow?: number;
  brokerName?: string;
  hdpData?: {
    homeInfo?: {
      daysOnZillow?: number;
      price?: number;
      zipcode?: string;
    };
  };
  [key: string]: unknown;
}

/** Minimal shape of items returned by the Zillow Owner Agent Scraper. */
export interface ZillowAgentItem {
  zpid?: string | number;
  agentName?: string;
  agentPhoneNumber?: string;
  agentEmail?: string;
  brokerName?: string;
  brokerPhoneNumber?: string;
  mlsName?: string;
  trueStatus?: string | null;
  isListedByOwner?: boolean;
  [key: string]: unknown;
}

export interface ApifyRunStatus {
  id: string;
  status: string; // READY | RUNNING | SUCCEEDED | FAILED | TIMING-OUT | TIMED-OUT | ABORTING | ABORTED
  defaultDatasetId: string;
  stats?: { inputBodyLen?: number; outputBodyLen?: number };
}

/** Shape of items returned by parseforge/auction-com-property-scraper. */
export interface AuctionListingItem {
  id?: string | number;
  url?: string;
  primary_photo_url?: string;
  address?: string;
  country_primary_subdivision?: string;
  country_secondary_subdivision?: string;
  municipality?: string;
  postal_code?: string;
  street_description?: string;
  latitude?: number;
  longitude?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lot_sqft?: number;
  year_built?: number;
  property_type?: string;
  property_type_group?: string;
  opening_bid?: number | null;
  starting_bid_amount?: number | null;
  auction_start_date?: string | null;
  auction_end_date?: string | null;
  saleType?: string;
  auctionDate?: string;
  auctionTime?: string;
  auctionLocation?: string;
  status?: string;
  buyer_premium_available?: boolean;
  interior_access_allowed?: boolean;
  occupancy_status?: string;
  is_first_look_enabled?: boolean;
  is_direct_offer_enabled?: boolean;
  [key: string]: unknown;
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function loadApifyCredentials(
  supabase: SupabaseClient,
): Promise<ApifyCredentials> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("slug", "apify")
    .single();

  if (!integration) throw new Error("Apify integration not found in integrations table");

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("id, encrypted_credentials, credentials_iv")
    .eq("integration_id", integration.id)
    .single();

  if (!cred?.encrypted_credentials || !cred.credentials_iv) {
    throw new Error("Apify credentials not configured — set API token in Admin > Integrations");
  }

  const raw = JSON.parse(await decrypt(cred.encrypted_credentials, cred.credentials_iv)) as {
    apiToken?: string;
    searchActorId?: string;
    agentActorId?: string;
  };

  if (!raw.apiToken) {
    throw new Error("Apify API token is empty — configure it in Admin > Integrations > Apify");
  }

  return {
    integrationId: integration.id as string,
    credentialId: cred.id as string,
    apiToken: raw.apiToken,
    searchActorId: raw.searchActorId || DEFAULT_SEARCH_ACTOR_ID,
    agentActorId: raw.agentActorId || DEFAULT_AGENT_ACTOR_ID,
  };
}

// ─── Actor runs ───────────────────────────────────────────────────────────────

/**
 * Start an Apify actor run and return the run object.
 * `input` is the actor-specific JSON input payload.
 */
export async function startActorRun(
  apiToken: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<ApifyRunStatus> {
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify startActorRun failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json() as { data: ApifyRunStatus };
  return json.data;
}

/**
 * Poll an Apify run until it reaches a terminal status.
 * Resolves once succeeded; throws on failure / timeout.
 */
export async function waitForRun(
  apiToken: string,
  runId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<ApifyRunStatus> {
  const { timeoutMs = 5 * 60_000, intervalMs = 5_000 } = opts;
  const deadline = Date.now() + timeoutMs;
  const terminal = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { "Authorization": `Bearer ${apiToken}` },
    });

    if (!res.ok) continue; // transient – keep polling

    const json = await res.json() as { data: ApifyRunStatus };
    const run = json.data;

    if (terminal.has(run.status)) {
      if (run.status !== "SUCCEEDED") {
        throw new Error(`Apify run ${runId} ended with status ${run.status}`);
      }
      return run;
    }
  }

  throw new Error(`Apify run ${runId} did not complete within ${timeoutMs / 1000}s`);
}

/**
 * Fetch all items from an Apify dataset. Handles pagination automatically.
 */
export async function fetchDatasetItems<T = unknown>(
  apiToken: string,
  datasetId: string,
  opts: { limit?: number } = {},
): Promise<T[]> {
  const limit = opts.limit ?? 1000;
  const pageSize = 1000;
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const url =
      `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?offset=${offset}&limit=${Math.min(pageSize, limit - results.length)}&clean=true&format=json`;

    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Apify fetchDataset failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const page = await res.json() as T[];
    results.push(...page);

    if (page.length < pageSize || results.length >= limit) break;
    offset += page.length;
  }

  return results;
}

/**
 * Fetch current status of an Apify run (non-blocking poll).
 */
export async function getRunStatus(
  apiToken: string,
  runId: string,
): Promise<ApifyRunStatus | null> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json() as { data: ApifyRunStatus };
  return json.data;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/** Write one entry to integration_api_logs (best-effort, non-throwing). */
export async function logApifyCall(
  supabase: SupabaseClient,
  integrationId: string,
  opts: {
    endpoint: string;
    status: number;
    latencyMs: number;
    errorMessage?: string;
  },
): Promise<void> {
  try {
    await supabase.from("integration_api_logs").insert({
      integration_id: integrationId,
      endpoint: opts.endpoint,
      status_code: opts.status,
      latency_ms: opts.latencyMs,
      error_message: opts.errorMessage ?? null,
      direction: "outbound",
    });
  } catch {
    // non-critical
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalise a US phone number to digits only (country code 1 prefixed).
 * Returns empty string if fewer than 10 digits remain after stripping.
 */
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits.length >= 7 ? digits : "";
}

/**
 * Build the dedup key for a Zillow agent lead.
 * Prefer phone-based key; fall back to name+broker slug.
 */
export function buildExternalId(
  phone: string,
  agentName?: string,
  brokerName?: string,
): string {
  const norm = normalizePhone(phone);
  if (norm) return `zillow-agent:${norm}`;

  const slugify = (s: string) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `zillow-agent:name:${slugify(agentName || "unknown")}:${slugify(brokerName || "unknown")}`;
}
