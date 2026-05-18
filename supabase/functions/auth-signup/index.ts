import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { isSignupDomainEmail, isValidEmailFormat } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const HAS_UPPER = /[A-Z]/;
const HAS_NUMBER = /[0-9]/;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { email, password, name } = body;

  if (!name || name.trim().length < 2) {
    return jsonResponse({ error: "Name must be at least 2 characters" }, 400);
  }
  if (!email || !isValidEmailFormat(email)) {
    return jsonResponse({ error: "Invalid email address" }, 400);
  }
  if (!isSignupDomainEmail(email)) {
    return jsonResponse(
      { error: "Sign-up requires a @mrshortsale.net email address" },
      400,
    );
  }
  if (!password || password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }
  if (!HAS_UPPER.test(password)) {
    return jsonResponse({ error: "Password must contain at least one uppercase letter" }, 400);
  }
  if (!HAS_NUMBER.test(password)) {
    return jsonResponse({ error: "Password must contain at least one number" }, 400);
  }

  // Check for existing email — return specific message based on existing account status
  const { data: existing } = await supabase
    .from("users")
    .select("id, status")
    .filter("email", "ilike", email.trim())
    .limit(1);

  if (existing && existing.length > 0) {
    const existingStatus = existing[0].status as string;
    if (existingStatus === "pending") {
      return jsonResponse({ error: "An account with this email is already awaiting approval." }, 409);
    }
    if (existingStatus === "rejected") {
      return jsonResponse(
        { error: "This email was not approved. Contact your administrator." },
        409,
      );
    }
    return jsonResponse({ error: "Email already registered" }, 409);
  }

  const { data: hash, error: hashError } = await supabase.rpc("hash_password", {
    input_password: password,
  });

  if (hashError || !hash) {
    console.error("Hash error:", hashError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  // Insert as pending — no JWT issued until CEO approves
  const { data: newUser, error: insertError } = await supabase
    .from("users")
    .insert({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      password_hash: hash,
      role: "rep",
      status: "pending",
      is_active: false,
    })
    .select("id, email, name, role, status")
    .single();

  if (insertError || !newUser) {
    console.error("Insert error:", insertError);
    return jsonResponse({ error: "Failed to create account" }, 500);
  }

  return jsonResponse(
    {
      message:
        "Account created. Your signup is pending CEO approval. You can sign in once approved.",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
      },
    },
    201,
  );
});
