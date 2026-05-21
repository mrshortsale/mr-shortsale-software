import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { generateState, fetchMicrosoftCredentials } from "../_shared/microsoftAuth.ts";

const STATE_SECRET = Deno.env.get("JWT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/auth-microsoft-callback`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function failRedirect(error: string): Response {
  return Response.redirect(`${FRONTEND_URL}/login?error=${error}`, 302);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const creds = await fetchMicrosoftCredentials(supabase);
  if (!creds) {
    console.warn("[microsoft-auth] Microsoft Sign-In credentials not configured in DB");
    return failRedirect("microsoft_not_configured");
  }

  const state = await generateState(STATE_SECRET);

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.searchParams.set("client_id", creds.clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile User.Read");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return Response.redirect(authUrl.toString(), 302);
});
