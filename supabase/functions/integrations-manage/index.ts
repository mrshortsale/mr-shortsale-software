import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { encrypt, decrypt } from "../_shared/crypto.ts";
import {
  loadBridgeCredentials,
  discoverDatasets,
  testMlsProfile,
  type MlsSyncProfile,
} from "../_shared/bridge.ts";

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

function maskCredential(value: string): string {
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}

function sanitizeBaseUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;
  return url.trim().replace(/\/+$/, "").replace(/\/api\/v1\/?.*$/i, "") || null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  // GET: list all integrations with their credential status
  if (req.method === "GET") {
    const { data: integrations, error } = await supabase
      .from("integrations")
      .select("*")
      .order("is_builtin", { ascending: false })
      .order("name");

    if (error) return jsonResponse({ error: "Failed to fetch integrations" }, 500);

    const { data: credentials } = await supabase
      .from("integration_credentials")
      .select("id, integration_id, status, base_url, last_tested_at, last_test_status, last_test_error, created_at, updated_at");

    const credMap = new Map<string, typeof credentials extends (infer T)[] | null ? T : never>();
    if (credentials) {
      for (const cred of credentials) {
        credMap.set(cred.integration_id, cred);
      }
    }

    const result = integrations!.map((i) => {
      const cred = credMap.get(i.id);
      return {
        ...i,
        credential_status: cred?.status ?? null,
        credential_id: cred?.id ?? null,
        base_url: cred?.base_url ?? i.default_base_url,
        last_tested_at: cred?.last_tested_at ?? null,
        last_test_status: cred?.last_test_status ?? null,
        last_test_error: cred?.last_test_error ?? null,
      };
    });

    return jsonResponse({ integrations: result });
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

  const { action } = body;

  // CREATE: add a custom integration + optionally store credentials
  if (action === "create") {
    const { name, slug, description, authMethod, baseUrl, credentials: creds } = body as {
      name?: string; slug?: string; description?: string; authMethod?: string; baseUrl?: string;
      credentials?: Record<string, string>;
    };

    if (!name || name.trim().length < 2) return jsonResponse({ error: "Name is required (min 2 chars)" }, 400);
    if (!authMethod) return jsonResponse({ error: "authMethod is required" }, 400);

    const validMethods = ["api_key", "basic_auth", "oauth2", "inbound_webhook", "none"];
    if (!validMethods.includes(authMethod)) {
      return jsonResponse({ error: `authMethod must be one of: ${validMethods.join(", ")}` }, 400);
    }

    const finalSlug = (slug || name).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!finalSlug) return jsonResponse({ error: "Could not generate a valid slug" }, 400);

    const { data: integration, error: insertErr } = await supabase
      .from("integrations")
      .insert({
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        category: "custom",
        auth_method: authMethod,
        is_builtin: false,
        default_base_url: baseUrl?.trim() || null,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") return jsonResponse({ error: "Integration slug already exists" }, 409);
      return jsonResponse({ error: "Failed to create integration" }, 500);
    }

    // Store credentials if provided
    if (creds && Object.keys(creds).length > 0) {
      const credsJson = JSON.stringify(creds);
      const { ciphertext, iv } = await encrypt(credsJson);

      let webhookSecret: string | null = null;
      if (authMethod === "inbound_webhook") {
        webhookSecret = crypto.randomUUID() + crypto.randomUUID();
      }

      await supabase.from("integration_credentials").insert({
        integration_id: integration.id,
        status: "disabled",
        encrypted_credentials: ciphertext,
        credentials_iv: iv,
        base_url: baseUrl?.trim() || null,
        oauth_authorization_url: creds.authorizationUrl || null,
        oauth_token_url: creds.tokenUrl || null,
        webhook_secret: webhookSecret,
        configured_by: ceoId,
      });
    } else if (authMethod === "inbound_webhook") {
      const webhookSecret = crypto.randomUUID() + crypto.randomUUID();
      const { ciphertext, iv } = await encrypt(JSON.stringify({}));

      await supabase.from("integration_credentials").insert({
        integration_id: integration.id,
        status: "disabled",
        encrypted_credentials: ciphertext,
        credentials_iv: iv,
        webhook_secret: webhookSecret,
        configured_by: ceoId,
      });
    }

    return jsonResponse({ integration }, 201);
  }

  // CONFIGURE: store/update credentials for an existing integration
  if (action === "configure") {
    const { integrationId, credentials: creds, baseUrl } = body as {
      integrationId?: string; credentials?: Record<string, string>; baseUrl?: string;
    };

    if (!integrationId) return jsonResponse({ error: "integrationId is required" }, 400);

    const { data: integration } = await supabase
      .from("integrations")
      .select("id, auth_method")
      .eq("id", integrationId)
      .single();

    if (!integration) return jsonResponse({ error: "Integration not found" }, 404);

    const { data: existing } = await supabase
      .from("integration_credentials")
      .select("id, webhook_secret, encrypted_credentials, credentials_iv")
      .eq("integration_id", integrationId)
      .single();

    let mergedCreds: Record<string, string> = { ...(creds || {}) };
    if (existing?.encrypted_credentials && existing.credentials_iv) {
      try {
        const previous = JSON.parse(
          await decrypt(existing.encrypted_credentials, existing.credentials_iv),
        ) as Record<string, string>;
        mergedCreds = { ...previous, ...mergedCreds };
      } catch {
        // ignore — will use incoming creds only
      }
    }

    delete mergedCreds._baseUrl;

    // Trim all string fields; drop empty api key so merge keeps previous
    for (const [k, v] of Object.entries(mergedCreds)) {
      if (typeof v === "string") mergedCreds[k] = v.trim();
    }
    if (!mergedCreds.apiKey) delete mergedCreds.apiKey;

    const cleanBaseUrl = sanitizeBaseUrl(baseUrl);

    // For inbound_webhook integrations, appSecret is stored as the HMAC key
    // (webhook_secret column) rather than in the encrypted blob.
    let webhookSecretValue: string | null = existing?.webhook_secret ?? null;
    if (integration.auth_method === "inbound_webhook") {
      if (mergedCreds.appSecret) {
        webhookSecretValue = mergedCreds.appSecret;
        delete mergedCreds.appSecret;
      } else if (!webhookSecretValue) {
        // First-time setup with no appSecret provided — generate a placeholder
        webhookSecretValue = crypto.randomUUID() + crypto.randomUUID();
      }
    }

    const credsJson = JSON.stringify(mergedCreds);
    const { ciphertext, iv } = await encrypt(credsJson);

    if (existing) {
      await supabase
        .from("integration_credentials")
        .update({
          encrypted_credentials: ciphertext,
          credentials_iv: iv,
          base_url: cleanBaseUrl,
          oauth_authorization_url: creds?.authorizationUrl || null,
          oauth_token_url: creds?.tokenUrl || null,
          webhook_secret: webhookSecretValue,
          configured_by: ceoId,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("integration_credentials").insert({
        integration_id: integrationId,
        status: "disabled",
        encrypted_credentials: ciphertext,
        credentials_iv: iv,
        base_url: cleanBaseUrl,
        oauth_authorization_url: creds?.authorizationUrl || null,
        oauth_token_url: creds?.tokenUrl || null,
        webhook_secret: webhookSecretValue,
        configured_by: ceoId,
      });
    }

    return jsonResponse({ success: true });
  }

  // TOGGLE: enable/disable an integration
  if (action === "toggle") {
    const { integrationId, enabled } = body as { integrationId?: string; enabled?: boolean };
    if (!integrationId) return jsonResponse({ error: "integrationId is required" }, 400);

    const newStatus = enabled ? "connected" : "disabled";

    const { error: updateErr } = await supabase
      .from("integration_credentials")
      .update({ status: newStatus })
      .eq("integration_id", integrationId);

    if (updateErr) return jsonResponse({ error: "Failed to toggle integration" }, 500);
    return jsonResponse({ success: true, status: newStatus });
  }

  // UPDATE: update integration metadata (custom only)
  if (action === "update") {
    const { integrationId, name, description, baseUrl } = body as {
      integrationId?: string; name?: string; description?: string; baseUrl?: string;
    };
    if (!integrationId) return jsonResponse({ error: "integrationId is required" }, 400);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (baseUrl !== undefined) updates.default_base_url = baseUrl.trim() || null;

    if (Object.keys(updates).length === 0) return jsonResponse({ error: "No fields to update" }, 400);

    const { error: updateErr } = await supabase
      .from("integrations")
      .update(updates)
      .eq("id", integrationId)
      .eq("is_builtin", false);

    if (updateErr) return jsonResponse({ error: "Failed to update integration" }, 500);
    return jsonResponse({ success: true });
  }

  // DELETE: remove a custom integration
  if (action === "delete") {
    const { integrationId } = body as { integrationId?: string };
    if (!integrationId) return jsonResponse({ error: "integrationId is required" }, 400);

    const { data: integration } = await supabase
      .from("integrations")
      .select("id, is_builtin")
      .eq("id", integrationId)
      .single();

    if (!integration) return jsonResponse({ error: "Integration not found" }, 404);
    if (integration.is_builtin) return jsonResponse({ error: "Cannot delete built-in integrations" }, 400);

    const { error: deleteErr } = await supabase
      .from("integrations")
      .delete()
      .eq("id", integrationId);

    if (deleteErr) return jsonResponse({ error: "Failed to delete integration" }, 500);
    return jsonResponse({ success: true });
  }

  // GET_CREDENTIALS: fetch decrypted credentials (masked for frontend display)
  if (action === "get_credentials") {
    const { integrationId } = body as { integrationId?: string };
    if (!integrationId) return jsonResponse({ error: "integrationId is required" }, 400);

    const { data: integration } = await supabase
      .from("integrations")
      .select("slug, auth_method")
      .eq("id", integrationId)
      .single();

    const { data: cred } = await supabase
      .from("integration_credentials")
      .select("*")
      .eq("integration_id", integrationId)
      .single();

    if (!cred) return jsonResponse({ error: "No credentials configured" }, 404);

    try {
      const decrypted = await decrypt(cred.encrypted_credentials, cred.credentials_iv);
      const parsed = JSON.parse(decrypted) as Record<string, string>;

      const masked: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        masked[k] = maskCredential(v);
      }

      // Webhook URL uses the integration slug so the webhook-receiver can look it up
      const webhookUrl = cred.webhook_secret && integration?.slug
        ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-receiver/${integration.slug}`
        : null;

      return jsonResponse({
        credentials: masked,
        status: cred.status,
        base_url: cred.base_url,
        webhook_secret: cred.webhook_secret ? maskCredential(cred.webhook_secret) : null,
        webhook_url: webhookUrl,
        last_tested_at: cred.last_tested_at,
        last_test_status: cred.last_test_status,
        last_test_error: cred.last_test_error,
      });
    } catch {
      return jsonResponse({ error: "Failed to decrypt credentials" }, 500);
    }
  }

  // GET_API_USAGE: fetch API usage logs
  if (action === "get_api_usage") {
    const { integrationId, limit = 100, offset = 0 } = body as {
      integrationId?: string; limit?: number; offset?: number;
    };

    let query = supabase
      .from("integration_api_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (integrationId) {
      query = query.eq("integration_id", integrationId);
    }

    const { data: logs, count, error: logsErr } = await query;
    if (logsErr) return jsonResponse({ error: "Failed to fetch API logs" }, 500);

    return jsonResponse({ logs: logs || [], total: count || 0 });
  }

  // ── MLS PROFILE ACTIONS ─────────────────────────────────────────────────────

  // LIST_MLS_PROFILES: all profiles attached to the zillow integration
  if (action === "list_mls_profiles") {
    const { data: profiles, error: listErr } = await supabase
      .from("bridge_mls_sync_profiles")
      .select("*")
      .order("created_at");

    if (listErr) return jsonResponse({ error: "Failed to fetch MLS profiles" }, 500);
    return jsonResponse({ profiles: profiles ?? [] });
  }

  // CREATE_MLS_PROFILE: add a new MLS dataset feed
  if (action === "create_mls_profile") {
    const { datasetId, displayName } = body as { datasetId?: string; displayName?: string };
    if (!datasetId || !/^[a-z0-9_]+$/i.test(datasetId.trim())) {
      return jsonResponse({ error: "datasetId is required and must match [a-zA-Z0-9_]+" }, 400);
    }

    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("slug", "zillow")
      .single();

    if (!integration) return jsonResponse({ error: "Zillow integration not found" }, 404);

    const { data: profile, error: insertErr } = await supabase
      .from("bridge_mls_sync_profiles")
      .insert({
        integration_id: integration.id,
        dataset_id: datasetId.trim(),
        display_name: (displayName ?? datasetId).trim(),
        enabled: false,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") return jsonResponse({ error: "A profile for this dataset_id already exists" }, 409);
      return jsonResponse({ error: "Failed to create MLS profile" }, 500);
    }
    return jsonResponse({ profile }, 201);
  }

  // UPDATE_MLS_PROFILE: edit any config field on a profile
  if (action === "update_mls_profile") {
    const {
      profileId,
      displayName,
      enabled,
      stateAllowlist,
      keywordFilters,
      conditionFilters,
      odataFilterOverride,
      selectFields,
      pageSize,
      sortOrder,
    } = body as {
      profileId?: string;
      displayName?: string;
      enabled?: boolean;
      stateAllowlist?: string[];
      keywordFilters?: string[];
      conditionFilters?: string[];
      odataFilterOverride?: string | null;
      selectFields?: string[];
      pageSize?: number;
      sortOrder?: string;
    };

    if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

    const updates: Record<string, unknown> = {};
    if (displayName !== undefined) updates.display_name = displayName.trim();
    if (enabled !== undefined) updates.enabled = enabled;
    if (stateAllowlist !== undefined) updates.state_allowlist = stateAllowlist;
    if (keywordFilters !== undefined) updates.keyword_filters = keywordFilters;
    if (conditionFilters !== undefined) updates.condition_filters = conditionFilters;
    if (odataFilterOverride !== undefined) updates.odata_filter_override = odataFilterOverride || null;
    if (selectFields !== undefined) updates.select_fields = selectFields;
    if (pageSize !== undefined) updates.page_size = Math.min(200, Math.max(1, pageSize));
    if (sortOrder !== undefined) updates.sort_order = sortOrder.trim();

    if (Object.keys(updates).length === 0) return jsonResponse({ error: "No fields to update" }, 400);

    const { data: updated, error: updateErr } = await supabase
      .from("bridge_mls_sync_profiles")
      .update(updates)
      .eq("id", profileId)
      .select()
      .single();

    if (updateErr) return jsonResponse({ error: "Failed to update MLS profile" }, 500);
    return jsonResponse({ profile: updated });
  }

  // DELETE_MLS_PROFILE: remove profile + cascade (raw, agent leads, runs)
  if (action === "delete_mls_profile") {
    const { profileId } = body as { profileId?: string };
    if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

    const { error: deleteErr } = await supabase
      .from("bridge_mls_sync_profiles")
      .delete()
      .eq("id", profileId);

    if (deleteErr) return jsonResponse({ error: "Failed to delete MLS profile" }, 500);
    return jsonResponse({ success: true });
  }

  // TEST_MLS_PROFILE: fire a $top=1 probe and update last_test_*
  if (action === "test_mls_profile") {
    const { profileId } = body as { profileId?: string };
    if (!profileId) return jsonResponse({ error: "profileId is required" }, 400);

    const { data: profile, error: profErr } = await supabase
      .from("bridge_mls_sync_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (profErr || !profile) return jsonResponse({ error: "MLS profile not found" }, 404);

    const { credentials, error: credErr } = await loadBridgeCredentials(supabase);
    if (credErr) return jsonResponse({ error: credErr }, 400);

    const result = await testMlsProfile(profile as MlsSyncProfile, credentials);

    await supabase
      .from("bridge_mls_sync_profiles")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: result.success ? "success" : "failure",
        last_test_error: result.error ?? null,
      })
      .eq("id", profileId);

    return jsonResponse({
      success: result.success,
      latency_ms: result.latencyMs,
      sample: result.sample,
      error: result.error,
      debug: result.debug,
    });
  }

  // DISCOVER_MLS_DATASETS: proxy Bridge /datasets endpoint for the dropdown
  if (action === "discover_mls_datasets") {
    const { credentials, error: credErr } = await loadBridgeCredentials(supabase);
    if (credErr) return jsonResponse({ error: credErr }, 400);

    const { datasets, error: discErr } = await discoverDatasets(credentials.baseUrl, credentials.apiKey);
    if (discErr) return jsonResponse({ error: discErr }, 502);
    return jsonResponse({ datasets });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
