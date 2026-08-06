import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { isValidEmailFormat } from "../_shared/email.ts";

/**
 * Direct password change (no email).
 * POST { email, currentPassword, password }
 * → verifies existing password, then updates password_hash.
 */
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

  let body: { email?: string; currentPassword?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim();
  const currentPassword = body.currentPassword;
  const password = body.password;

  if (!email || !isValidEmailFormat(email)) {
    return jsonResponse({ error: "Invalid email address" }, 400);
  }

  if (!currentPassword) {
    return jsonResponse({ error: "Current password is required" }, 400);
  }

  if (!password) {
    return jsonResponse({ error: "New password is required" }, 400);
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
  if (password === currentPassword) {
    return jsonResponse(
      { error: "New password must be different from your current password" },
      400,
    );
  }

  const { data: rows, error: dbError } = await supabase
    .from("users")
    .select("id, is_active, status, password_hash")
    .filter("email", "ilike", email)
    .limit(1);

  if (dbError) {
    console.error("DB error during password change:", dbError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  const user = rows?.[0];
  if (!user) {
    return jsonResponse({ error: "Invalid email or current password" }, 401);
  }
  if (user.status !== "active" || !user.is_active) {
    return jsonResponse(
      { error: "This account is not active. Contact your administrator." },
      403,
    );
  }

  const { data: valid, error: verifyError } = await supabase.rpc("verify_password", {
    input_password: currentPassword,
    stored_hash: user.password_hash,
  });

  if (verifyError) {
    console.error("Verify password error:", verifyError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  if (!valid) {
    return jsonResponse({ error: "Invalid email or current password" }, 401);
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
    .eq("id", user.id);

  if (updateError) {
    console.error("Failed to update password:", updateError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  await supabase
    .from("password_reset_tokens")
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null);

  return jsonResponse({
    message: "Password updated successfully. You can now sign in with your new password.",
  });
});
