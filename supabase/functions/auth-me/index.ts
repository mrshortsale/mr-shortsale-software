import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return jsonResponse({ error: "Missing token" }, 401);
  }

  let payload: { sub: string };
  try {
    payload = await verifyJwt(token) as { sub: string };
  } catch {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, role, avatar_color, is_active, status")
    .eq("id", payload.sub)
    .single();

  if (error || !user) {
    return jsonResponse({ error: "User not found" }, 401);
  }

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
    return jsonResponse({ error: "Account is deactivated. Contact your administrator." }, 403);
  }

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarColor: user.avatar_color,
    },
  });
});
