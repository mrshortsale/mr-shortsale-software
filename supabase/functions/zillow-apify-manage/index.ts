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

// Zillow region IDs for US states (regionType 2 = state-level)
const STATE_REGION_IDS: Record<string, number> = {
  AL: 1, AK: 2, AZ: 3, AR: 4, CA: 9, CO: 5, CT: 6, DE: 7, DC: 8,
  FL: 14, GA: 10, HI: 11, ID: 13, IL: 12, IN: 15, IA: 16, KS: 17,
  KY: 18, LA: 19, ME: 20, MD: 21, MA: 22, MI: 23, MN: 24, MS: 25,
  MO: 26, MT: 27, NE: 28, NV: 29, NH: 30, NJ: 31, NM: 32, NY: 34,
  NC: 33, ND: 35, OH: 36, OK: 37, OR: 38, PA: 39, RI: 40, SC: 41,
  SD: 42, TN: 43, TX: 44, UT: 45, VA: 46, VT: 47, WA: 48, WI: 49,
  WV: 50, WY: 51,
};

// Approximate bounding boxes for US states — used by PAGINATION_WITH_ZOOM_IN
// to know which map area to tile. Values match what Zillow's own URLs produce.
type Bounds = { north: number; south: number; east: number; west: number };
const STATE_BOUNDS: Record<string, Bounds> = {
  FL: { north: 32.812, south: 22.438, east: -75.169, west: -92.440 },
  CA: { north: 42.010, south: 32.530, east: -114.130, west: -124.410 },
  TX: { north: 36.500, south: 25.837, east: -93.508, west: -106.646 },
  NY: { north: 45.015, south: 40.477, east: -71.777, west: -79.762 },
  GA: { north: 35.001, south: 30.355, east: -80.840, west: -85.606 },
  NC: { north: 36.588, south: 33.843, east: -75.460, west: -84.322 },
  AZ: { north: 37.004, south: 31.332, east: -109.045, west: -114.815 },
  NJ: { north: 41.357, south: 38.928, east: -73.893, west: -75.560 },
  PA: { north: 42.269, south: 39.720, east: -74.689, west: -80.519 },
  OH: { north: 41.978, south: 38.403, east: -80.519, west: -84.820 },
  IL: { north: 42.508, south: 36.970, east: -87.020, west: -91.513 },
  WA: { north: 49.002, south: 45.543, east: -116.916, west: -124.848 },
  CO: { north: 41.003, south: 36.993, east: -102.042, west: -109.060 },
  VA: { north: 39.466, south: 36.540, east: -75.166, west: -83.675 },
  TN: { north: 36.678, south: 34.983, east: -81.647, west: -90.310 },
  SC: { north: 35.215, south: 32.034, east: -78.541, west: -83.354 },
  MI: { north: 48.306, south: 41.696, east: -82.413, west: -90.418 },
  MN: { north: 49.385, south: 43.499, east: -89.491, west: -97.239 },
  WI: { north: 47.309, south: 42.492, east: -86.250, west: -92.889 },
  OR: { north: 46.239, south: 41.992, east: -116.463, west: -124.566 },
  NV: { north: 42.002, south: 35.002, east: -114.039, west: -120.005 },
  MD: { north: 39.723, south: 37.911, east: -74.986, west: -79.487 },
  MA: { north: 42.887, south: 41.237, east: -69.928, west: -73.508 },
};

interface SearchConfig {
  // Raw URL paste mode: takes precedence if set
  rawUrl?: string;
  // Builder fields
  state?: string;          // 2-letter abbreviation, e.g. "fl"
  regionId?: string;       // override Zillow regionId if known
  mapBounds?: { north: number; south: number; east: number; west: number };
  listingType?: "forSale" | "forRent" | "sold";
  shortSaleOnly?: boolean;
  foreclosureOnly?: boolean;
  daysOnZillow?: number;   // 1, 3, 7, 14, 30, 90, 180, 365
  priceMin?: number;
  priceMax?: number;
}

function buildSearchUrl(config: SearchConfig): string {
  if (config.rawUrl) return config.rawUrl.trim();

  const filterState: Record<string, unknown> = {
    sort: { value: "globalrelevanceex" },
  };

  // Listing type filters (default = for-sale agent listings, no extra flags needed)
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

  // Short sale: Zillow uses att:{value:"short sale"}, NOT ss:{value:true}
  if (config.shortSaleOnly) {
    filterState["att"] = { value: "short sale" };
  }
  if (config.foreclosureOnly) {
    filterState["fore"] = { value: true };
  }
  if (config.daysOnZillow) {
    filterState["doz"] = { value: String(config.daysOnZillow) };
  }
  if (config.priceMin !== undefined && config.priceMin > 0) {
    filterState["price"] = { min: config.priceMin, ...(filterState["price"] as object ?? {}) };
  }
  if (config.priceMax !== undefined && config.priceMax > 0) {
    filterState["price"] = { ...(filterState["price"] as object ?? {}), max: config.priceMax };
  }

  const stateSlug = (config.state || "fl").toLowerCase();
  const stateUpper = stateSlug.toUpperCase();
  const regionId = config.regionId
    ? Number(config.regionId)
    : (STATE_REGION_IDS[stateUpper] ?? null);

  // Use provided bounds, then state-level preset, so PAGINATION_WITH_ZOOM_IN
  // knows which map area to tile (without bounds it may return 0 results).
  const bounds = config.mapBounds ?? STATE_BOUNDS[stateUpper] ?? null;

  const searchQueryState: Record<string, unknown> = {
    isMapVisible: true,
    filterState,
    isListVisible: true,
    usersSearchTerm: stateUpper,
    mapZoom: 7,
  };

  if (bounds) searchQueryState["mapBounds"] = bounds;

  if (regionId) {
    // regionType 2 = US state; regionType 6 = city (incorrect for state searches)
    searchQueryState["regionSelection"] = [{ regionId, regionType: 2 }];
  }

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
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
  const { displayName, searchUrl, searchConfig, enabled } = body as {
    displayName?: string;
    searchUrl?: string;
    searchConfig?: Record<string, unknown>;
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
      enabled: enabled ?? false,
    })
    .select()
    .single();

  if (error) return jsonResponse({ error: "Failed to create profile" }, 500);
  return jsonResponse({ profile: data }, 201);
}

async function updateProfile(body: Record<string, unknown>) {
  const { profileId, displayName, searchUrl, searchConfig, enabled } = body as {
    profileId?: string;
    displayName?: string;
    searchUrl?: string;
    searchConfig?: Record<string, unknown>;
    enabled?: boolean;
  };

  if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

  const patch: Record<string, unknown> = {};
  if (displayName !== undefined) patch["display_name"] = displayName.trim();
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
    .select("search_url")
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
