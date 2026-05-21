import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { generateState } from "../_shared/googleAuth.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const STATE_SECRET = Deno.env.get("JWT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/auth-google-callback`;

function failRedirect(res: string): Response {
  return Response.redirect(`${FRONTEND_URL}/login?error=${res}`, 302);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!CLIENT_ID || !SUPABASE_URL) {
    console.warn("[google-auth] GOOGLE_CLIENT_ID or SUPABASE_URL not set");
    return failRedirect("google_not_configured");
  }

  const state = await generateState(STATE_SECRET);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("access_type", "offline");

  return Response.redirect(authUrl.toString(), 302);
});
