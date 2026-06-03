import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { isValidEmailFormat } from "../_shared/email.ts";
import {
  generateResetToken,
  hashToken,
  sendPasswordResetEmail,
} from "../_shared/mailer.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
const TOKEN_TTL_MS = 60 * 60 * 1000;

const GENERIC_MESSAGE =
  "If an account exists for that email, you will receive a password reset link shortly.";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim();
  if (!email || !isValidEmailFormat(email)) {
    return jsonResponse({ error: "Invalid email address" }, 400);
  }

  const { data: rows, error: dbError } = await supabase
    .from("users")
    .select("id, email, name, is_active, status")
    .filter("email", "ilike", email)
    .limit(1);

  if (dbError) {
    console.error("DB error during forgot-password:", dbError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  const user = rows?.[0];
  if (user && user.is_active && user.status === "active") {
    const rawToken = generateResetToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id)
      .is("used_at", null);

    const { error: insertError } = await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Failed to store reset token:", insertError);
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail(user.email, resetUrl, user.name);
  }

  return jsonResponse({ message: GENERIC_MESSAGE });
});
