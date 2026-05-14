import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

  // Server-side validation
  if (!name || name.trim().length < 2) {
    return jsonResponse({ error: "Name must be at least 2 characters" }, 400);
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    return jsonResponse({ error: "Invalid email address" }, 400);
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

  // Check for existing email
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .filter("email", "ilike", email.trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return jsonResponse({ error: "Email already registered" }, 409);
  }

  // Hash password via RPC
  const { data: hash, error: hashError } = await supabase.rpc("hash_password", {
    input_password: password,
  });

  if (hashError || !hash) {
    console.error("Hash error:", hashError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  // Insert new user (always 'rep' role on signup)
  const { data: newUser, error: insertError } = await supabase
    .from("users")
    .insert({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      password_hash: hash,
      role: "rep",
    })
    .select("id, email, name, role, avatar_color")
    .single();

  if (insertError || !newUser) {
    console.error("Insert error:", insertError);
    return jsonResponse({ error: "Failed to create account" }, 500);
  }

  const token = await signJwt({ sub: newUser.id, email: newUser.email, role: newUser.role });

  return jsonResponse({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      avatarColor: newUser.avatar_color,
    },
  }, 201);
});
