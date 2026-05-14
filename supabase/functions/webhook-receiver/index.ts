import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

Deno.serve(async (req) => {
  // Allow CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract integration slug from the URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path format: /functions/v1/webhook-receiver/{slug}
  const slug = pathParts[pathParts.length - 1];

  if (!slug || slug === "webhook-receiver") {
    return new Response(JSON.stringify({ error: "Integration slug required in URL path" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Look up integration by slug
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, slug, auth_method")
    .eq("slug", slug)
    .single();

  if (!integration) {
    return new Response(JSON.stringify({ error: "Integration not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (integration.auth_method !== "inbound_webhook") {
    return new Response(JSON.stringify({ error: "Integration is not configured for inbound webhooks" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch credentials to check status + webhook secret
  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("id, status, webhook_secret")
    .eq("integration_id", integration.id)
    .single();

  if (!cred || cred.status !== "connected") {
    return new Response(JSON.stringify({ error: "Integration is not active" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Failed to read request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify HMAC signature if webhook_secret is set and signature header is present
  const signatureHeader = req.headers.get("x-webhook-signature") ||
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-signature");

  if (cred.webhook_secret && signatureHeader) {
    const isValid = await verifyHmac(rawBody, signatureHeader, cred.webhook_secret);
    if (!isValid) {
      await supabase.from("integration_api_logs").insert({
        integration_id: integration.id,
        credential_id: cred.id,
        method: req.method,
        endpoint: url.pathname,
        status_code: 401,
        latency_ms: Date.now() - startTime,
        request_size_bytes: rawBody.length,
        error_message: "HMAC signature verification failed",
        direction: "inbound",
      });

      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const latencyMs = Date.now() - startTime;

  // Log the incoming webhook payload
  await supabase.from("integration_api_logs").insert({
    integration_id: integration.id,
    credential_id: cred.id,
    method: req.method,
    endpoint: url.pathname,
    status_code: 200,
    latency_ms: latencyMs,
    request_size_bytes: rawBody.length,
    response_size_bytes: 0,
    direction: "inbound",
  });

  return new Response(JSON.stringify({ received: true, timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
