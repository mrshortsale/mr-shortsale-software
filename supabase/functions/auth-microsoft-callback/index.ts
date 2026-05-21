import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { signJwt } from "../_shared/jwt.ts";
import {
  verifyState,
  fetchMicrosoftCredentials,
  loginOrProvisionWithMicrosoft,
  type MicrosoftProfile,
} from "../_shared/microsoftAuth.ts";

const STATE_SECRET = Deno.env.get("JWT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/auth-microsoft-callback`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function fail(error: string): Response {
  return Response.redirect(`${FRONTEND_URL}/login?error=${error}`, 302);
}

async function exchangeCode(code: string, clientId: string, clientSecret: string): Promise<{ access_token: string }> {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json();
}

async function fetchProfile(accessToken: string): Promise<MicrosoftProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Failed to fetch Microsoft profile");

  const data = await res.json() as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
    givenName?: string;
    surname?: string;
  };

  const email = data.mail ?? data.userPrincipalName ?? "";
  if (!email) throw new Error("No email returned from Microsoft profile");

  return {
    sub: data.id,
    email,
    name: data.displayName ?? "",
    givenName: data.givenName ?? "",
    familyName: data.surname ?? "",
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

  if (error) return fail("microsoft_consent_denied");

  if (!code || !state) return fail("microsoft_invalid_state");

  const stateOk = await verifyState(state, STATE_SECRET);
  if (!stateOk) return fail("microsoft_invalid_state");

  const creds = await fetchMicrosoftCredentials(supabase);
  if (!creds) return fail("microsoft_not_configured");

  try {
    const tokens = await exchangeCode(code, creds.clientId, creds.clientSecret);
    const profile = await fetchProfile(tokens.access_token);

    const result = await loginOrProvisionWithMicrosoft(profile, supabase);
    if (!result.ok) return fail(result.error);

    const token = await signJwt({
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    return Response.redirect(
      `${FRONTEND_URL}/auth/microsoft/callback?token=${encodeURIComponent(token)}`,
      302,
    );
  } catch (err) {
    console.error("[microsoft-auth] callback error:", err);
    return fail("microsoft_auth_failed");
  }
});
