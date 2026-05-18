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

interface HealthCheckResult {
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
  requestUrl?: string;
}

const BATCH_LEADS_BASE = "https://app.batchleads.io";
const BATCH_LEADS_TAGS = "/api/v1/tags";

function isBatchLeads(integration: { slug: string; name: string }): boolean {
  return integration.slug === "batchleads" ||
    integration.name.toLowerCase().includes("batch leads");
}

function sanitizeBaseUrl(url: string): string {
  return normalizeBaseUrl(url).replace(/\/api\/v1\/?.*$/i, "");
}

/** Built-in integrations with non-standard auth or health endpoints */
// See https://developer.batchservice.com/docs/batchleads — host app.batchleads.io, header api-key
function getApiKey(creds: Record<string, string>): string | undefined {
  const raw = creds.apiKey || creds.api_key || creds["api-key"];
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || undefined;
}

const BUILTIN_HEALTH: Record<string, { endpoint: string; headers: (creds: Record<string, string>) => Record<string, string> }> = {
  batchleads: {
    endpoint: "/api/v1/tags",
    headers: (creds) => {
      const key = getApiKey(creds);
      return key ? { "api-key": key } : {};
    },
  },
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildAuthHeaders(authMethod: string, credentials: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (authMethod) {
    case "api_key": {
      const key = getApiKey(credentials);
      if (key) {
        headers["Authorization"] = `Bearer ${key}`;
        headers["apikey"] = key;
        headers["api-key"] = key;
      }
      break;
    }
    case "basic_auth":
      if (credentials.username && credentials.password) {
        const encoded = btoa(`${credentials.username}:${credentials.password}`);
        headers["Authorization"] = `Basic ${encoded}`;
      }
      break;
    case "oauth2":
      if (credentials.accessToken) {
        headers["Authorization"] = `Bearer ${credentials.accessToken}`;
      }
      break;
  }

  return headers;
}

async function performHealthCheck(
  baseUrl: string,
  healthEndpoint: string | null,
  authHeaders: Record<string, string>,
): Promise<HealthCheckResult> {
  const base = normalizeBaseUrl(baseUrl);
  const path = healthEndpoint?.startsWith("/") ? healthEndpoint : `/${healthEndpoint ?? ""}`;
  const url = healthEndpoint ? `${base}${path}` : base;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      headers: { ...authHeaders, "Accept": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    let apiMessage: string | undefined;
    try {
      const body = await response.json() as { errors?: string; error?: string; message?: string };
      apiMessage = body.errors || body.error || body.message;
    } catch {
      // ignore non-JSON bodies
    }

    if (response.ok || response.status === 401 || response.status === 403) {
      return {
        success: response.ok,
        statusCode: response.status,
        latencyMs,
        requestUrl: url,
        error: response.ok
          ? undefined
          : apiMessage || `Authentication failed (HTTP ${response.status})`,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      latencyMs,
      requestUrl: url,
      error: apiMessage || `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      latencyMs,
      requestUrl: url,
      error: message.includes("abort") ? "Connection timeout (10s)" : message,
    };
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { integrationId } = body as { integrationId?: string };
  if (!integrationId) {
    return jsonResponse({ error: "integrationId is required" }, 400);
  }

  // Fetch integration + credentials
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!integration) {
    return jsonResponse({ error: "Integration not found" }, 404);
  }

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("*")
    .eq("integration_id", integrationId)
    .single();

  if (!cred) {
    return jsonResponse({ error: "No credentials configured for this integration" }, 400);
  }

  // Decrypt credentials
  let credentials: Record<string, string> = {};
  try {
    const decrypted = await decrypt(cred.encrypted_credentials, cred.credentials_iv);
    credentials = JSON.parse(decrypted);
    delete credentials._baseUrl;
  } catch {
    return jsonResponse({ error: "Failed to decrypt credentials" }, 500);
  }

  // For OAuth, use the stored access token
  if (integration.auth_method === "oauth2" && cred.oauth_access_token) {
    try {
      const accessToken = await decrypt(cred.oauth_access_token, cred.credentials_iv);
      credentials.accessToken = accessToken;
    } catch {
      // Fall through with whatever credentials we have
    }
  }

  // Determine base URL
  let baseUrl = sanitizeBaseUrl(cred.base_url || integration.default_base_url || "");
  if (isBatchLeads(integration)) {
    baseUrl = baseUrl || BATCH_LEADS_BASE;
  }
  if (!baseUrl && integration.auth_method !== "inbound_webhook") {
    return jsonResponse({ error: "No base URL configured" }, 400);
  }

  const apiKey = getApiKey(credentials);

  // For inbound_webhook type, just check that the webhook secret exists
  if (integration.auth_method === "inbound_webhook") {
    const result: HealthCheckResult = {
      success: !!cred.webhook_secret,
      latencyMs: 0,
      error: cred.webhook_secret ? undefined : "Webhook secret not configured",
    };

    await updateTestResult(integrationId, cred.id, result);

    // Log the test
    await supabase.from("integration_api_logs").insert({
      integration_id: integrationId,
      credential_id: cred.id,
      method: "HEALTH_CHECK",
      endpoint: "webhook-secret-verify",
      status_code: result.success ? 200 : 500,
      latency_ms: result.latencyMs,
      error_message: result.error || null,
      direction: "outbound",
    });

    return jsonResponse({
      success: result.success,
      latency_ms: result.latencyMs,
      error: result.error,
    });
  }

  // Batch Leads: match official docs (GET app.batchleads.io/api/v1/tags, header api-key)
  const batchLeads = isBatchLeads(integration);
  const builtin = batchLeads ? BUILTIN_HEALTH.batchleads : BUILTIN_HEALTH[integration.slug as string];
  const healthEndpoint = batchLeads ? BATCH_LEADS_TAGS : (builtin?.endpoint ?? integration.health_check_endpoint);
  const authHeaders = batchLeads
    ? BUILTIN_HEALTH.batchleads.headers(credentials)
    : (builtin?.headers(credentials) ?? buildAuthHeaders(integration.auth_method, credentials));

  if (batchLeads && !apiKey) {
    return jsonResponse({
      success: false,
      latency_ms: 0,
      error: "No API key stored. Edit credentials, paste your Batch Leads api-key, save, then test again.",
      debug: { request_url: `${baseUrl}${BATCH_LEADS_TAGS}`, api_key_length: 0 },
    }, 400);
  }

  const result = await performHealthCheck(baseUrl!, healthEndpoint, authHeaders);

  // Update credential record with test result
  await updateTestResult(integrationId, cred.id, result);

  // Log the API call
  await supabase.from("integration_api_logs").insert({
    integration_id: integrationId,
    credential_id: cred.id,
    method: "GET",
    endpoint: healthEndpoint || baseUrl!,
    status_code: result.statusCode || null,
    latency_ms: result.latencyMs,
    error_message: result.error || null,
    direction: "outbound",
  });

  return jsonResponse({
    success: result.success,
    latency_ms: result.latencyMs,
    status_code: result.statusCode,
    error: result.error,
    debug: {
      request_url: result.requestUrl,
      api_key_length: apiKey?.length ?? 0,
    },
  });
});

async function updateTestResult(integrationId: string, credId: string, result: HealthCheckResult) {
  const newStatus = result.success ? "connected" : "error";
  await supabase
    .from("integration_credentials")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: result.success ? "success" : "failure",
      last_test_error: result.error || null,
      status: newStatus,
    })
    .eq("id", credId);
}
