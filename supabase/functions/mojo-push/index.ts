/**
 * mojo-push
 *
 * Receives a list of realtor agents and forwards each as a JSON payload
 * to the Mojo Dialer via a Zapier catch-hook webhook.
 *
 * POST { agents: AgentPayload[] }
 * → decrypts the zapierWebhookUrl stored in integration_credentials for mojo-dialer
 * → POSTs each agent to Zapier sequentially
 * → returns { ok, sent, failed, errors }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentPayload {
  id: string;
  agentName: string;
  brokerage: string;
  agentPhone: string;
  agentEmail: string;
  latestPropertyAddress: string;
  latestCity: string;
  latestState: string;
  latestListingId: string;
  latestListPrice: number;
  latestDaysOnMarket: number;
  latestPublicRemarks: string;
  datasetId: string;
  status: string;
  language: string;
}

interface ZapierPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  source: string;
  mls_number: string;
  list_price: number;
  days_on_market: number;
  listing_url: string;
  brokerage: string;
  language: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildZillowUrl(address: string, city: string, state: string): string {
  const slug = `${address} ${city} ${state}`
    .replace(/[,#]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}/`;
}

function extractZip(address: string, city: string, state: string): string {
  // Try to find a 5-digit zip in the concatenated string
  const match = `${address} ${city} ${state}`.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : "";
}

function toZapierPayload(agent: AgentPayload): ZapierPayload {
  const price = agent.latestListPrice
    ? `$${agent.latestListPrice.toLocaleString("en-US")}`
    : "price unknown";

  return {
    name: agent.agentName || "Unknown Agent",
    phone: agent.agentPhone || "",
    email: agent.agentEmail || "",
    address: agent.latestPropertyAddress || "",
    city: agent.latestCity || "",
    state: agent.latestState || "",
    zip: extractZip(agent.latestPropertyAddress, agent.latestCity, agent.latestState),
    notes: [
      `MLS# ${agent.latestListingId || "N/A"}`,
      price,
      agent.brokerage || "",
      agent.datasetId || "Bridge MLS",
      "Short sale",
    ].filter(Boolean).join(" | "),
    source: "Bridge MLS",
    mls_number: agent.latestListingId || "",
    list_price: agent.latestListPrice || 0,
    days_on_market: agent.latestDaysOnMarket || 0,
    listing_url: agent.latestPropertyAddress
      ? buildZillowUrl(agent.latestPropertyAddress, agent.latestCity, agent.latestState)
      : "",
    brokerage: agent.brokerage || "",
    language: agent.language || "EN",
    status: agent.status || "New",
  };
}

// ─── Webhook URL loader ────────────────────────────────────────────────────────

async function loadZapierWebhookUrl(): Promise<{ url: string; error: string | null }> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("slug", "mojo-dialer")
    .single();

  if (!integration) {
    return { url: "", error: "Mojo Dialer integration not found" };
  }

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("encrypted_credentials, credentials_iv, base_url")
    .eq("integration_id", integration.id)
    .single();

  if (!cred) {
    return { url: "", error: "Mojo Dialer credentials not configured. Add the Zapier webhook URL in Integrations → Mojo Dialer." };
  }

  // base_url can hold a pre-seeded plaintext webhook URL (used when no encrypted creds exist yet)
  if (cred.base_url?.startsWith("http")) {
    return { url: cred.base_url, error: null };
  }

  if (!cred.encrypted_credentials || !cred.credentials_iv) {
    return { url: "", error: "No Zapier webhook URL configured. Edit credentials in Integrations → Mojo Dialer and paste your Zapier catch-hook URL." };
  }

  try {
    const decrypted = JSON.parse(
      await decrypt(cred.encrypted_credentials, cred.credentials_iv),
    ) as Record<string, string>;

    const webhookUrl = decrypted.zapierWebhookUrl || decrypted.apiKey || "";
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      return { url: "", error: "No Zapier webhook URL configured. Edit credentials in Integrations → Mojo Dialer and paste your Zapier catch-hook URL." };
    }
    return { url: webhookUrl, error: null };
  } catch {
    return { url: "", error: "Failed to decrypt Mojo Dialer credentials" };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { agents?: AgentPayload[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const agents = body.agents ?? [];
  if (agents.length === 0) {
    return jsonResponse({ error: "agents array is required and must not be empty" }, 400);
  }

  const { url: webhookUrl, error: urlError } = await loadZapierWebhookUrl();
  if (urlError) return jsonResponse({ error: urlError }, 400);

  // Send each agent to Zapier sequentially (Zapier rate limits: ~100 req/min)
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const agent of agents) {
    const payload = toZapierPayload(agent);
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        sent++;
      } else {
        failed++;
        const body = await resp.text().catch(() => "");
        errors.push(`${agent.agentName}: HTTP ${resp.status} — ${body.slice(0, 100)}`);
      }
    } catch (err) {
      failed++;
      errors.push(`${agent.agentName}: ${err instanceof Error ? err.message : "Network error"}`);
    }
  }

  return jsonResponse({
    ok: failed === 0,
    sent,
    failed,
    errors: errors.slice(0, 10),
  });
});
