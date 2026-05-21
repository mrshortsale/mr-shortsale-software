import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { signJwt } from "../_shared/jwt.ts";
import {
  verifyState,
  fetchGoogleCredentials,
  loginOrProvisionWithGoogle,
  type GoogleProfile,
} from "../_shared/googleAuth.ts";

const STATE_SECRET = Deno.env.get("JWT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/auth-google-callback`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function fail(error: string): Response {
  return Response.redirect(`${FRONTEND_URL}/login?error=${error}`, 302);
}

async function exchangeCode(code: string, clientId: string, clientSecret: string): Promise<{ id_token: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json();
}

async function verifyIdToken(idToken: string, clientId: string): Promise<GoogleProfile> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!res.ok) throw new Error("ID token verification failed");

  const data = await res.json() as {
    sub: string;
    email: string;
    email_verified: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    aud: string;
  };

  if (data.aud !== clientId) throw new Error("ID token audience mismatch");
  if (data.email_verified !== "true") throw new Error("Google account email is not verified");

  return {
    sub: data.sub,
    email: data.email,
    emailVerified: true,
    name: data.name ?? "",
    givenName: data.given_name ?? "",
    familyName: data.family_name ?? "",
    picture: data.picture ?? "",
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return fail("google_consent_denied");

  if (!code || !state) return fail("google_invalid_state");

  const stateOk = await verifyState(state, STATE_SECRET);
  if (!stateOk) return fail("google_invalid_state");

  const creds = await fetchGoogleCredentials(supabase);
  if (!creds) return fail("google_not_configured");

  try {
    const tokens = await exchangeCode(code, creds.clientId, creds.clientSecret);
    const profile = await verifyIdToken(tokens.id_token, creds.clientId);

    const result = await loginOrProvisionWithGoogle(profile, supabase);
    if (!result.ok) return fail(result.error);

    const token = await signJwt({
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    return Response.redirect(
      `${FRONTEND_URL}/auth/google/callback?token=${encodeURIComponent(token)}`,
      302,
    );
  } catch (err) {
    console.error("[google-auth] callback error:", err);
    return fail("google_auth_failed");
  }
});
