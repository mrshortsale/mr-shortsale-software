import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

// Meta uses HMAC-SHA256 with hex encoding (X-Hub-Signature-256: sha256=HEX)
async function verifyMetaHmac(payload: string, signatureHeader: string, secret: string): Promise<boolean> {
  const expected = signatureHeader.replace(/^sha256=/i, "");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}

// Generic base64 HMAC for non-Meta inbound webhooks
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

// Extract slug from URL path: /functions/v1/webhook-receiver/{slug}
function extractSlug(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  return slug && slug !== "webhook-receiver" ? slug : null;
}

interface MetaLeadgenValue {
  leadgen_id: string;
  page_id: string;
  form_id: string;
  ad_id?: string;
  adgroup_id?: string;
  created_time?: number;
}

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      field: string;
      value: MetaLeadgenValue;
    }>;
  }>;
}

interface GraphLeadField {
  name: string;
  values: string[];
}

interface GraphLeadResponse {
  field_data: GraphLeadField[];
  created_time?: string;
  ad_id?: string;
  form_id?: string;
  id: string;
}

function extractField(fieldData: GraphLeadField[], ...names: string[]): string {
  for (const name of names) {
    const f = fieldData.find((fd) => fd.name.toLowerCase() === name.toLowerCase());
    if (f?.values?.[0]) return f.values[0];
  }
  return "";
}

async function processMetaLead(
  leadgenId: string,
  pageAccessToken: string,
  rawValue: MetaLeadgenValue,
): Promise<void> {
  const graphUrl = `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,created_time,ad_id,form_id&access_token=${pageAccessToken}`;
  const res = await fetch(graphUrl);
  if (!res.ok) {
    throw new Error(`Graph API error ${res.status}: ${await res.text()}`);
  }
  const lead = await res.json() as GraphLeadResponse;
  const fields = lead.field_data || [];

  const ownerName = extractField(fields, "full_name", "name", "first_name") ||
    extractField(fields, "last_name");
  const phone = extractField(fields, "phone_number", "phone");
  const email = extractField(fields, "email");
  const address = extractField(fields, "street_address", "address");
  const city = extractField(fields, "city");
  const state = extractField(fields, "state");

  const externalId = leadgenId;
  const id = `meta-${externalId}`;

  await supabase.from("inventory_leads").upsert({
    id,
    source: "Meta",
    external_id: externalId,
    owner: ownerName || "Unknown",
    address: address,
    city: city,
    state: state,
    county: "",
    equity_pct: 0,
    days_to_auction: 999,
    score: 5,
    language: "EN",
    status: "New",
    received_at: rawValue.created_time
      ? new Date(rawValue.created_time * 1000).toISOString()
      : new Date().toISOString(),
    raw_payload: {
      ...rawValue,
      graph_response: lead,
      phone,
      email,
    },
  }, { onConflict: "source,external_id" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = extractSlug(url);

  if (!slug) {
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

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("id, status, webhook_secret, encrypted_credentials, credentials_iv")
    .eq("integration_id", integration.id)
    .single();

  // Meta webhook verification: GET with hub.mode / hub.verify_token / hub.challenge
  if (req.method === "GET" && slug === "meta-ads") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !token || !challenge) {
      return new Response(JSON.stringify({ error: "Invalid verification request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt stored verifyToken and compare
    let storedVerifyToken = "";
    if (cred?.encrypted_credentials && cred.credentials_iv) {
      try {
        const decrypted = JSON.parse(
          await decrypt(cred.encrypted_credentials, cred.credentials_iv),
        ) as Record<string, string>;
        storedVerifyToken = decrypted.verifyToken || "";
      } catch {
        // ignore
      }
    }

    if (!storedVerifyToken || token !== storedVerifyToken) {
      return new Response(JSON.stringify({ error: "Verify token mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the challenge as plain text — Meta requires this exact format
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  // HMAC signature verification
  const signatureHeader = req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-signature");

  if (cred.webhook_secret && signatureHeader) {
    // Meta uses hex-encoded HMAC (sha256=HEX); generic webhooks use base64
    const isValid = slug === "meta-ads"
      ? await verifyMetaHmac(rawBody, signatureHeader, cred.webhook_secret)
      : await verifyHmac(rawBody, signatureHeader, cred.webhook_secret);

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

  // Meta Lead Ads: parse leadgen payload, fetch from Graph API, store lead
  if (slug === "meta-ads") {
    try {
      const payload = JSON.parse(rawBody) as MetaWebhookPayload;

      // Decrypt pageAccessToken for Graph API calls
      let pageAccessToken = "";
      if (cred.encrypted_credentials && cred.credentials_iv) {
        const decrypted = JSON.parse(
          await decrypt(cred.encrypted_credentials, cred.credentials_iv),
        ) as Record<string, string>;
        pageAccessToken = decrypted.pageAccessToken || "";
      }

      if (pageAccessToken && payload.object === "page") {
        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === "leadgen" && change.value?.leadgen_id) {
              await processMetaLead(change.value.leadgen_id, pageAccessToken, change.value);
            }
          }
        }
      }
    } catch (err) {
      // Log the error but still return 200 so Meta doesn't retry indefinitely
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabase.from("integration_api_logs").insert({
        integration_id: integration.id,
        credential_id: cred.id,
        method: req.method,
        endpoint: url.pathname,
        status_code: 200,
        latency_ms: Date.now() - startTime,
        request_size_bytes: rawBody.length,
        error_message: `Lead processing error: ${message}`,
        direction: "inbound",
      });

      return new Response(JSON.stringify({ received: true, warning: message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const latencyMs = Date.now() - startTime;

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
