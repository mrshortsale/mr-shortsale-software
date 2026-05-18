import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signJwt } from "../_shared/jwt.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { email, password } = body;

  if (!email || !password) {
    return jsonResponse({ error: "Email and password are required" }, 400);
  }

  const { data: rows, error: dbError } = await supabase
    .from("users")
    .select("id, email, name, role, avatar_color, is_active, status, password_hash")
    .filter("email", "ilike", email.trim())
    .limit(1);

  if (dbError) {
    console.error("DB error during login:", dbError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  if (!rows || rows.length === 0) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  const user = rows[0];

  // Check approval status before password verification to avoid timing leaks
  if (user.status === "pending") {
    return jsonResponse(
      { error: "Your account is pending approval. Please contact your administrator." },
      403,
    );
  }

  if (user.status === "rejected") {
    return jsonResponse(
      { error: "Your signup request was not approved. Please contact your administrator." },
      403,
    );
  }

  if (!user.is_active) {
    return jsonResponse(
      { error: "Account is deactivated. Contact your administrator." },
      403,
    );
  }

  const { data: valid, error: cryptoError } = await supabase.rpc("verify_password", {
    input_password: password,
    stored_hash: user.password_hash,
  });

  if (cryptoError) {
    console.error("Crypto error:", cryptoError);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  if (!valid) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

  const token = await signJwt({ sub: user.id, email: user.email, role: user.role });

  return jsonResponse({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarColor: user.avatar_color,
    },
  });
});
