import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { hashToken } from "../_shared/mailer.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const HAS_UPPER = /[A-Z]/;
const HAS_NUMBER = /[0-9]/;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { token, password } = body;

  if (!token || !password) {
    return jsonResponse({ error: "Token and password are required" }, 400);
  }

  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }
  if (!HAS_UPPER.test(password)) {
    return jsonResponse({ error: "Password must contain at least one uppercase letter" }, 400);
  }
  if (!HAS_NUMBER.test(password)) {
    return jsonResponse({ error: "Password must contain at least one number" }, 400);
  }

  const tokenHash = await hashToken(token);

  const { data: tokenRows, error: tokenError } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .limit(1);

  if (tokenError) {
    console.error("DB error during reset-password:", tokenError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  const resetToken = tokenRows?.[0];
  if (!resetToken || resetToken.used_at) {
    return jsonResponse({ error: "Invalid or expired reset link" }, 400);
  }

  if (new Date(resetToken.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: "Invalid or expired reset link" }, 400);
  }

  const { data: hash, error: hashError } = await supabase.rpc("hash_password", {
    input_password: password,
  });

  if (hashError || !hash) {
    console.error("Hash error:", hashError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: hash })
    .eq("id", resetToken.user_id);

  if (updateError) {
    console.error("Failed to update password:", updateError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", resetToken.id);

  return jsonResponse({ message: "Password updated successfully" });
});
