import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { encrypt, decrypt } from "../_shared/crypto.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  ).then(async (key) => {
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  });
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  return expected === signature;
}

const STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET") || Deno.env.get("JWT_SECRET") || "";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);

  // POST /integrations-oauth-callback/initiate — generate the auth URL + state
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { integrationId } = body as { integrationId?: string };
    if (!integrationId) return jsonResponse({ error: "integrationId is required" }, 400);

    const { data: cred } = await supabase
      .from("integration_credentials")
      .select("*")
      .eq("integration_id", integrationId)
      .single();

    if (!cred) return jsonResponse({ error: "No credentials configured" }, 404);

    // Decrypt to get client_id
    let credentials: Record<string, string> = {};
    try {
      const decrypted = await decrypt(cred.encrypted_credentials, cred.credentials_iv);
      credentials = JSON.parse(decrypted);
    } catch {
      return jsonResponse({ error: "Failed to decrypt credentials" }, 500);
    }

    if (!credentials.clientId || !cred.oauth_authorization_url) {
      return jsonResponse({ error: "OAuth client_id and authorization URL are required" }, 400);
    }

    // Generate signed state parameter (CSRF protection)
    const statePayload = `${integrationId}:${Date.now()}`;
    const signature = await hmacSign(statePayload, STATE_SECRET);
    const state = btoa(JSON.stringify({ payload: statePayload, sig: signature }));

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integrations-oauth-callback`;

    const authUrl = new URL(cred.oauth_authorization_url);
    authUrl.searchParams.set("client_id", credentials.clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    if (credentials.scope) {
      authUrl.searchParams.set("scope", credentials.scope);
    }

    return jsonResponse({ authorizationUrl: authUrl.toString() });
  }

  // GET /integrations-oauth-callback?code=...&state=... — handle provider callback
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      const errorDesc = url.searchParams.get("error_description") || errorParam;
      return Response.redirect(`${FRONTEND_URL}?oauth_error=${encodeURIComponent(errorDesc)}`, 302);
    }

    if (!code || !stateParam) {
      return Response.redirect(`${FRONTEND_URL}?oauth_error=missing_params`, 302);
    }

    // Verify state
    let integrationId: string;
    try {
      const decoded = JSON.parse(atob(stateParam));
      const isValid = await hmacVerify(decoded.payload, decoded.sig, STATE_SECRET);
      if (!isValid) throw new Error("Invalid signature");

      integrationId = decoded.payload.split(":")[0];

      // Check for expiry (15 minutes)
      const timestamp = parseInt(decoded.payload.split(":")[1]);
      if (Date.now() - timestamp > 15 * 60 * 1000) throw new Error("State expired");
    } catch {
      return Response.redirect(`${FRONTEND_URL}?oauth_error=invalid_state`, 302);
    }

    // Fetch integration + credentials
    const { data: cred } = await supabase
      .from("integration_credentials")
      .select("*")
      .eq("integration_id", integrationId)
      .single();

    if (!cred || !cred.oauth_token_url) {
      return Response.redirect(`${FRONTEND_URL}?oauth_error=config_missing`, 302);
    }

    let credentials: Record<string, string> = {};
    try {
      const decrypted = await decrypt(cred.encrypted_credentials, cred.credentials_iv);
      credentials = JSON.parse(decrypted);
    } catch {
      return Response.redirect(`${FRONTEND_URL}?oauth_error=decrypt_failed`, 302);
    }

    // Exchange code for tokens
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integrations-oauth-callback`;
    try {
      const tokenResponse = await fetch(cred.oauth_token_url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl,
          client_id: credentials.clientId || "",
          client_secret: credentials.clientSecret || "",
        }),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("Token exchange failed:", errText);
        return Response.redirect(`${FRONTEND_URL}?oauth_error=token_exchange_failed`, 302);
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      // Encrypt and store tokens
      const { ciphertext: encAccess, iv: ivAccess } = await encrypt(tokens.access_token);
      const updates: Record<string, unknown> = {
        oauth_access_token: encAccess,
        status: "connected",
        last_tested_at: new Date().toISOString(),
        last_test_status: "success",
        last_test_error: null,
      };

      if (tokens.refresh_token) {
        const { ciphertext: encRefresh } = await encrypt(tokens.refresh_token);
        updates.oauth_refresh_token = encRefresh;
      }

      if (tokens.expires_in) {
        updates.oauth_token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      }

      // Store the IV used for token encryption alongside the credential IV
      updates.credentials_iv = ivAccess;

      await supabase
        .from("integration_credentials")
        .update(updates)
        .eq("id", cred.id);

      // Log success
      await supabase.from("integration_api_logs").insert({
        integration_id: integrationId,
        credential_id: cred.id,
        method: "POST",
        endpoint: cred.oauth_token_url,
        status_code: 200,
        latency_ms: 0,
        direction: "outbound",
      });

      return Response.redirect(`${FRONTEND_URL}?oauth_success=${integrationId}`, 302);
    } catch (err) {
      console.error("OAuth callback error:", err);
      return Response.redirect(`${FRONTEND_URL}?oauth_error=unexpected`, 302);
    }
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
