/**
 * normalize-state
 *
 * Zapier webhook: POST { state } → { state, state_name }
 * Recognized US states become USPS abbreviations (NY). Unknown values return empty strings.
 * Never returns an error payload for unrecognized input.
 * No webhook secret — Zapier only needs the URL and JSON body.
 */

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { STATE_NAMES, toStateAbbr } from "../_shared/usState.ts";

const EMPTY = { state: "", state_name: "" };

function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({
    fn: "normalize-state",
    event,
    ts: new Date().toISOString(),
    ...data,
  }));
}

function normalize(raw: unknown): { state: string; state_name: string } {
  const original = typeof raw === "string" ? raw.trim() : "";
  const abbr = toStateAbbr(original);
  return {
    state: abbr ?? "",
    state_name: abbr ? (STATE_NAMES[abbr] ?? "") : "",
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    log("method_not_allowed", { method: req.method });
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { state?: unknown } = {};
  try {
    const rawBody = await req.text();
    body = rawBody ? JSON.parse(rawBody) as { state?: unknown } : {};
  } catch {
    log("parse_failed");
    return jsonResponse(EMPTY);
  }

  const result = normalize(body.state);
  log("request_ok", {
    original: typeof body.state === "string" ? body.state : null,
    state: result.state,
    state_name: result.state_name,
  });
  return jsonResponse(result);
});
