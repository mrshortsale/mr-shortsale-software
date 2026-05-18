import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getCeoId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return null;

    const { data } = await supabase
      .from("users")
      .select("id, role, is_active, status")
      .eq("id", payload.sub)
      .single();

    if (!data || data.role !== "ceo" || !data.is_active || data.status !== "active") return null;
    return data.id;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const callerId = await getCeoId(req);
  if (!callerId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  // --- GET: list users ---
  // ?status=pending returns only pending users; default excludes pending
  if (req.method === "GET") {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");

    let query = supabase
      .from("users")
      .select("id, email, name, role, avatar_color, is_active, status, last_login_at, created_at")
      .order("name");

    if (statusFilter === "pending") {
      query = query.eq("status", "pending");
    } else {
      query = query.neq("status", "pending");
    }

    const { data, error } = await query;
    if (error) return jsonResponse({ error: "Failed to fetch users" }, 500);
    return jsonResponse({ users: data });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { action } = body;

  // --- APPROVE pending user ---
  if (action === "approve") {
    const { userId } = body as { userId?: string };
    if (!userId) return jsonResponse({ error: "userId is required" }, 400);
    if (userId === callerId) return jsonResponse({ error: "You cannot approve your own account" }, 400);

    const { data: target } = await supabase
      .from("users")
      .select("id, role, status")
      .eq("id", userId)
      .single();

    if (!target) return jsonResponse({ error: "User not found" }, 404);
    if (target.status !== "pending") return jsonResponse({ error: "User is not pending approval" }, 400);

    const { data: user, error } = await supabase
      .from("users")
      .update({ status: "active", is_active: true })
      .eq("id", userId)
      .select("id, email, name, role, avatar_color, is_active, status, last_login_at, created_at")
      .single();

    if (error || !user) return jsonResponse({ error: "Failed to approve user" }, 500);
    return jsonResponse({ user });
  }

  // --- REJECT pending user ---
  if (action === "reject") {
    const { userId } = body as { userId?: string };
    if (!userId) return jsonResponse({ error: "userId is required" }, 400);
    if (userId === callerId) return jsonResponse({ error: "You cannot reject your own account" }, 400);

    const { data: target } = await supabase
      .from("users")
      .select("id, role, status")
      .eq("id", userId)
      .single();

    if (!target) return jsonResponse({ error: "User not found" }, 404);
    if (target.status !== "pending") return jsonResponse({ error: "User is not pending approval" }, 400);
    if (target.role === "ceo") return jsonResponse({ error: "Cannot reject a CEO account" }, 400);

    const { data: user, error } = await supabase
      .from("users")
      .update({ status: "rejected", is_active: false })
      .eq("id", userId)
      .select("id, email, name, role, avatar_color, is_active, status, last_login_at, created_at")
      .single();

    if (error || !user) return jsonResponse({ error: "Failed to reject user" }, 500);
    return jsonResponse({ user });
  }

  // --- CREATE user ---
  if (action === "create") {
    const { email, name, password, role, avatarColor, approveImmediately } = body as {
      email?: string; name?: string; password?: string; role?: string;
      avatarColor?: string; approveImmediately?: boolean;
    };

    if (!name || String(name).trim().length < 2) return jsonResponse({ error: "Name must be at least 2 characters" }, 400);
    if (!email || !EMAIL_RE.test(String(email).trim())) return jsonResponse({ error: "Invalid email address" }, 400);
    if (!password || String(password).length < 8) return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
    if (!role || !["ceo", "rep"].includes(String(role))) return jsonResponse({ error: "Role must be 'ceo' or 'rep'" }, 400);

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .filter("email", "ilike", String(email).trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return jsonResponse({ error: "Email already registered" }, 409);
    }

    const { data: hash, error: hashError } = await supabase.rpc("hash_password", {
      input_password: password,
    });
    if (hashError || !hash) return jsonResponse({ error: "Internal server error" }, 500);

    const approved = approveImmediately === true;

    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert({
        email: String(email).trim().toLowerCase(),
        name: String(name).trim(),
        password_hash: hash,
        role: String(role),
        avatar_color: avatarColor || "#185FA5",
        status: approved ? "active" : "pending",
        is_active: approved,
      })
      .select("id, email, name, role, avatar_color, is_active, status, created_at")
      .single();

    if (insertError || !user) return jsonResponse({ error: "Failed to create user" }, 500);
    return jsonResponse({ user }, 201);
  }

  // --- UPDATE user ---
  if (action === "update") {
    const { userId, name, role, avatarColor, isActive, password } = body as {
      userId?: string; name?: string; role?: string; avatarColor?: string;
      isActive?: boolean; password?: string;
    };

    if (!userId) return jsonResponse({ error: "userId is required" }, 400);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (role !== undefined) {
      if (!["ceo", "rep"].includes(String(role))) return jsonResponse({ error: "Invalid role" }, 400);
      updates.role = String(role);
    }
    if (avatarColor !== undefined) updates.avatar_color = avatarColor;
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    if (password) {
      if (String(password).length < 8) return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
      const { data: hash, error: hashError } = await supabase.rpc("hash_password", {
        input_password: password,
      });
      if (hashError || !hash) return jsonResponse({ error: "Internal server error" }, 500);
      updates.password_hash = hash;
    }

    if (Object.keys(updates).length === 0) return jsonResponse({ error: "No fields to update" }, 400);

    const { data: user, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("id, email, name, role, avatar_color, is_active, status, last_login_at, created_at")
      .single();

    if (updateError || !user) return jsonResponse({ error: "Failed to update user" }, 500);
    return jsonResponse({ user });
  }

  // --- DELETE user ---
  if (action === "delete") {
    const { userId } = body as { userId?: string };

    if (!userId) return jsonResponse({ error: "userId is required" }, 400);
    if (userId === callerId) return jsonResponse({ error: "You cannot delete your own account" }, 400);

    const { error: deleteError } = await supabase.from("users").delete().eq("id", userId);
    if (deleteError) return jsonResponse({ error: "Failed to delete user" }, 500);

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
