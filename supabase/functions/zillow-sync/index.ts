import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";

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

// RESO standard field names used by Bridge Data Output
interface BridgeProperty {
  ListingId?: string;
  MlsStatus?: string;
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
}

interface BridgeResponse {
  value?: BridgeProperty[];
  bundle?: BridgeProperty[];
}

interface PriceDrop {
  date: string;
  amount: number;
}

interface RealtorLead {
  id: string;
  agentName: string;
  brokerage: string;
  agentPhone: string;
  agentEmail: string;
  mlsNumber: string;
  propertyAddress: string;
  city: string;
  state: string;
  listPrice: number;
  daysOnMarket: number;
  priceDrops: PriceDrop[];
  listingUrl: string;
  status: "New";
  lastContactAt: null;
  language: "EN" | "ES";
  source: "zillow";
}

function mapToRealtorLead(prop: BridgeProperty, index: number): RealtorLead {
  const priceDrops: PriceDrop[] = prop.PriceChangeTimestamp
    ? [{ date: prop.PriceChangeTimestamp.split("T")[0], amount: 0 }]
    : [];

  // Detect Spanish from remarks or agent name (basic heuristic)
  const remarks = (prop.PublicRemarks || "").toLowerCase();
  const language: "EN" | "ES" = remarks.includes("venta") || remarks.includes("corta") ? "ES" : "EN";

  const mlsId = prop.ListingId || `bdo-${index}`;
  const address = prop.UnparsedAddress || "";
  const city = prop.City || "";
  const state = prop.StateOrProvince || "";

  const slug = address.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);

  return {
    id: `zillow-${mlsId}`,
    agentName: prop.ListAgentFullName || "Unknown Agent",
    brokerage: prop.ListOfficeName || "",
    agentPhone: prop.ListAgentDirectPhone || "",
    agentEmail: prop.ListAgentEmail || "",
    mlsNumber: mlsId,
    propertyAddress: address,
    city,
    state,
    listPrice: prop.ListPrice || 0,
    daysOnMarket: prop.DaysOnMarket || 0,
    priceDrops,
    listingUrl: `https://www.zillow.com/homes/${slug}_rb/`,
    status: "New",
    lastContactAt: null,
    language,
    source: "zillow",
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const stateFilter = url.searchParams.get("state") || "";

  // Fetch Zillow integration credentials
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, default_base_url")
    .eq("slug", "zillow")
    .single();

  if (!integration) {
    return jsonResponse({ error: "Zillow integration not found" }, 404);
  }

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("id, status, encrypted_credentials, credentials_iv, base_url")
    .eq("integration_id", integration.id)
    .single();

  if (!cred) {
    return jsonResponse({ error: "Zillow credentials not configured" }, 400);
  }

  if (cred.status !== "connected") {
    return jsonResponse({ error: "Zillow integration is not connected" }, 400);
  }

  let apiKey = "";
  try {
    const decrypted = JSON.parse(
      await decrypt(cred.encrypted_credentials, cred.credentials_iv),
    ) as Record<string, string>;
    apiKey = decrypted.apiKey || decrypted.api_key || "";
  } catch {
    return jsonResponse({ error: "Failed to decrypt Zillow credentials" }, 500);
  }

  if (!apiKey) {
    return jsonResponse({ error: "No API key stored for Zillow" }, 400);
  }

  const baseUrl = (cred.base_url || integration.default_base_url || "https://api.bridgedataoutput.com")
    .replace(/\/+$/, "");

  // Build OData filter for short-sale listings
  let filter = "contains(PublicRemarks,'short sale')";
  if (stateFilter) {
    filter += ` and StateOrProvince eq '${stateFilter}'`;
  }

  const select = [
    "ListingId", "MlsStatus", "ListAgentFullName", "ListOfficeName",
    "ListAgentDirectPhone", "ListAgentEmail", "UnparsedAddress",
    "City", "StateOrProvince", "ListPrice", "DaysOnMarket",
    "PriceChangeTimestamp", "PublicRemarks",
  ].join(",");

  const oDataUrl = `${baseUrl}/api/v2/OData/Property?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$top=100&$orderby=DaysOnMarket%20desc`;

  const startTime = Date.now();

  let properties: BridgeProperty[] = [];
  let apiStatusCode = 200;
  let apiError: string | null = null;

  try {
    const response = await fetch(oDataUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    apiStatusCode = response.status;

    if (response.ok) {
      const data = await response.json() as BridgeResponse;
      properties = data.value || data.bundle || [];
    } else {
      apiError = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Network error";
    apiStatusCode = 0;
  }

  const latencyMs = Date.now() - startTime;

  // Log the API call
  await supabase.from("integration_api_logs").insert({
    integration_id: integration.id,
    credential_id: cred.id,
    method: "GET",
    endpoint: "/api/v2/OData/Property",
    status_code: apiStatusCode,
    latency_ms: latencyMs,
    error_message: apiError,
    direction: "outbound",
  });

  if (apiError) {
    return jsonResponse({ error: apiError }, apiStatusCode >= 400 ? apiStatusCode : 502);
  }

  const leads = properties.map((p, i) => mapToRealtorLead(p, i));

  return jsonResponse({ leads, total: leads.length, latency_ms: latencyMs });
});
