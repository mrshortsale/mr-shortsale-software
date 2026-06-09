/**
 * zillow-apify-manage
 *
 * CEO-authed CRUD for Zillow Apify sync profiles and a server-side URL builder.
 *
 * POST → action: LIST_PROFILES | CREATE_PROFILE | UPDATE_PROFILE | DELETE_PROFILE
 *               | TEST_PROFILE | BUILD_SEARCH_URL
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { loadApifyCredentials, startActorRun } from "../_shared/apify.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function requireCeo(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = (await verifyJwt(token)) as { sub: string; role: string };
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

// ─── URL builder ──────────────────────────────────────────────────────────────

interface SearchConfig {
  // Raw URL paste mode: takes precedence if set
  rawUrl?: string;
  // Builder fields
  state?: string;
  regionId?: string;
  mapBounds?: { north: number; south: number; east: number; west: number };
  listingType?: "forSale" | "forRent" | "sold";
  shortSaleOnly?: boolean;
  foreclosureOnly?: boolean;
  daysOnZillow?: number; // 1, 3, 7, 14, 30, 90, 180, 365
  priceMin?: number;
  priceMax?: number;
}

function buildSearchUrl(config: SearchConfig): string {
  // If CEO pasted a raw URL, return it unchanged
  if (config.rawUrl) return config.rawUrl.trim();

  const filterState: Record<string, unknown> = {
    sort: { value: "globalrelevanceex" },
    ah: { value: true }, // all homes
  };

  if (config.listingType === "forRent") {
    filterState["fr"] = { value: true };
    filterState["fsba"] = { value: false };
    filterState["fsbo"] = { value: false };
    filterState["nc"] = { value: false };
    filterState["cmsn"] = { value: false };
    filterState["auc"] = { value: false };
    filterState["fore"] = { value: false };
  } else if (config.listingType === "sold") {
    filterState["rs"] = { value: true };
    filterState["fsba"] = { value: false };
    filterState["fsbo"] = { value: false };
  }

  if (config.shortSaleOnly) {
    filterState["ss"] = { value: true };
  }
  if (config.foreclosureOnly) {
    filterState["fore"] = { value: true };
  }
  if (config.daysOnZillow) {
    filterState["doz"] = { value: String(config.daysOnZillow) };
  }
  if (config.priceMin) {
    filterState["price"] = { min: config.priceMin, ...(filterState["price"] as object ?? {}) };
  }
  if (config.priceMax) {
    filterState["price"] = { ...(filterState["price"] as object ?? {}), max: config.priceMax };
  }

  const searchQueryState: Record<string, unknown> = {
    filterState,
    isListVisible: true,
    mapZoom: 10,
  };

  if (config.regionId) {
    searchQueryState["regionSelection"] = [
      { regionId: Number(config.regionId), regionType: 6 },
    ];
  }
  if (config.mapBounds) {
    searchQueryState["mapBounds"] = config.mapBounds;
  }

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  const stateSlug = (config.state || "fl").toLowerCase();
  return `https://www.zillow.com/${stateSlug}/?searchQueryState=${encoded}`;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function listProfiles() {
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("slug", "apify")
    .single();

  const { data, error } = await supabase
    .from("zillow_apify_sync_profiles")
    .select("*")
    .order("display_name");

  if (error) return jsonResponse({ error: "Failed to load profiles" }, 500);

  return jsonResponse({ profiles: data ?? [], integrationId: integration?.id ?? null });
}

async function createProfile(body: Record<string, unknown>) {
  const { displayName, searchUrl, searchConfig, maxListings, enabled } = body as {
    displayName?: string;
    searchUrl?: string;
    searchConfig?: Record<string, unknown>;
    maxListings?: number;
    enabled?: boolean;
  };

  if (!displayName?.trim()) return jsonResponse({ error: "displayName is required" }, 400);

  const resolvedUrl = searchUrl?.trim() || (searchConfig
    ? buildSearchUrl(searchConfig as SearchConfig)
    : null);

  if (!resolvedUrl) {
    return jsonResponse({ error: "Either searchUrl or searchConfig is required" }, 400);
  }

  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("slug", "apify")
    .single();

  if (!integration) return jsonResponse({ error: "Apify integration not found" }, 404);

  const { data, error } = await supabase
    .from("zillow_apify_sync_profiles")
    .insert({
      integration_id: integration.id,
      display_name: displayName.trim(),
      search_url: resolvedUrl,
      search_config: searchConfig ?? {},
      max_listings: maxListings ?? 500,
      enabled: enabled ?? false,
    })
    .select()
    .single();

  if (error) return jsonResponse({ error: "Failed to create profile" }, 500);
  return jsonResponse({ profile: data }, 201);
}

async function updateProfile(body: Record<string, unknown>) {
  const { profileId, displayName, searchUrl, searchConfig, maxListings, enabled } = body as {
    profileId?: string;
    displayName?: string;
    searchUrl?: string;
    searchConfig?: Record<string, unknown>;
    maxListings?: number;
    enabled?: boolean;
  };

  if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

  const patch: Record<string, unknown> = {};
  if (displayName !== undefined) patch["display_name"] = displayName.trim();
  if (maxListings !== undefined) patch["max_listings"] = maxListings;
  if (enabled !== undefined) patch["enabled"] = enabled;

  if (searchConfig !== undefined) {
    patch["search_config"] = searchConfig;
    if (!searchUrl) {
      patch["search_url"] = buildSearchUrl(searchConfig as SearchConfig);
    }
  }
  if (searchUrl !== undefined) patch["search_url"] = searchUrl.trim();

  if (Object.keys(patch).length === 0) {
    return jsonResponse({ error: "No fields to update" }, 400);
  }

  const { data, error } = await supabase
    .from("zillow_apify_sync_profiles")
    .update(patch)
    .eq("id", profileId)
    .select()
    .single();

  if (error) return jsonResponse({ error: "Failed to update profile" }, 500);
  return jsonResponse({ profile: data });
}

async function deleteProfile(body: Record<string, unknown>) {
  const { profileId } = body as { profileId?: string };
  if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

  const { error } = await supabase
    .from("zillow_apify_sync_profiles")
    .delete()
    .eq("id", profileId);

  if (error) return jsonResponse({ error: "Failed to delete profile" }, 500);
  return jsonResponse({ ok: true });
}

async function testProfile(body: Record<string, unknown>) {
  const { profileId } = body as { profileId?: string };
  if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

  const { data: profile } = await supabase
    .from("zillow_apify_sync_profiles")
    .select("search_url, max_listings")
    .eq("id", profileId)
    .single();

  if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

  let creds: Awaited<ReturnType<typeof loadApifyCredentials>>;
  try {
    creds = await loadApifyCredentials(supabase);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 400);
  }

  try {
    const t0 = Date.now();
    const run = await startActorRun(creds.apiToken, creds.searchActorId, {
      searchUrls: [{ url: profile.search_url }],
      maxItems: 3,
    });
    return jsonResponse({
      success: true,
      runId: run.id,
      latencyMs: Date.now() - t0,
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 400);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) return jsonResponse({ error: "Unauthorized" }, 403);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { action } = body;

  if (action === "LIST_PROFILES") return listProfiles();
  if (action === "CREATE_PROFILE") return createProfile(body);
  if (action === "UPDATE_PROFILE") return updateProfile(body);
  if (action === "DELETE_PROFILE") return deleteProfile(body);
  if (action === "TEST_PROFILE") return testProfile(body);

  if (action === "BUILD_SEARCH_URL") {
    const { searchConfig } = body as { searchConfig?: Record<string, unknown> };
    if (!searchConfig) return jsonResponse({ error: "searchConfig is required" }, 400);
    return jsonResponse({ url: buildSearchUrl(searchConfig as SearchConfig) });
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400);
});
