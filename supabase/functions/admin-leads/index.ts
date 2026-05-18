import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const VALID_STATUSES = new Set(["New", "Contacted", "Promoted", "Dismissed"]);

async function requireCeo(req: Request): Promise<string | null> {
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

  const ceoId = await requireCeo(req);
  if (!ceoId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  // GET ?action=reps — return active sales reps for the rep-picker UI
  if (req.method === "GET" && action === "reps") {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, avatar_color, role, is_active, status")
      .eq("role", "rep")
      .eq("is_active", true)
      .or("status.eq.active,status.is.null")
      .order("name");
    if (error) return jsonResponse({ error: "Failed to load reps" }, 500);
    return jsonResponse({
      reps: (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatar_color: r.avatar_color,
      })),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { leadIds?: string[]; repId?: string | null; status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const leadIds = Array.isArray(body.leadIds) ? body.leadIds.filter((id) => typeof id === "string" && id) : [];
  if (leadIds.length === 0) {
    return jsonResponse({ error: "leadIds is required" }, 400);
  }
  if (leadIds.length > 5000) {
    return jsonResponse({ error: "Too many leads in one request (max 5000)" }, 400);
  }

  // POST ?action=assign — set assigned_rep_id (null to unassign)
  if (action === "assign") {
    const repId = body.repId === null ? null : body.repId;
    if (repId !== null) {
      if (typeof repId !== "string" || !repId) {
        return jsonResponse({ error: "repId must be a string or null" }, 400);
      }
      // Verify the rep exists and is active
      const { data: rep } = await supabase
        .from("users")
        .select("id, name")
        .eq("id", repId)
        .eq("role", "rep")
        .eq("is_active", true)
        .or("status.eq.active,status.is.null")
        .maybeSingle();
      if (!rep) {
        return jsonResponse({ error: "Rep not found or inactive. Approve the user under User Management first." }, 400);
      }
    }

    const { data: updatedRows, error } = await supabase
      .from("inventory_leads")
      .update({ assigned_rep_id: repId })
      .in("id", leadIds)
      .select("id");

    if (error) return jsonResponse({ error: "Failed to assign leads" }, 500);
    const updated = updatedRows?.length ?? 0;
    return jsonResponse({ ok: true, updated, repId });
  }

  // POST ?action=status — change lead status (New/Contacted/Promoted/Dismissed)
  if (action === "status") {
    const status = body.status;
    if (!status || !VALID_STATUSES.has(status)) {
      return jsonResponse({ error: `status must be one of ${[...VALID_STATUSES].join(", ")}` }, 400);
    }

    // When a lead moves to Contacted, bump the attempt counter + timestamp.
    const updates: Record<string, unknown> = { status };
    if (status === "Contacted") {
      updates.last_contact_date = new Date().toISOString();
    }

    const { error, count } = await supabase
      .from("inventory_leads")
      .update(updates, { count: "exact" })
      .in("id", leadIds);

    if (error) return jsonResponse({ error: "Failed to update status" }, 500);

    // For Contacted we additionally increment contact_attempts via an RPC-style
    // single SQL update. Supabase JS doesn't expose increment in one call, so
    // we do a follow-up fetch + write. Capped to leadIds length already.
    if (status === "Contacted") {
      const { data: rows } = await supabase
        .from("inventory_leads")
        .select("id, contact_attempts")
        .in("id", leadIds);
      const updates = (rows ?? []).map((r: { id: string; contact_attempts: number | null }) => ({
        id: r.id,
        contact_attempts: Number(r.contact_attempts ?? 0) + 1,
      }));
      if (updates.length > 0) {
        await Promise.all(
          updates.map((u) =>
            supabase
              .from("inventory_leads")
              .update({ contact_attempts: u.contact_attempts })
              .eq("id", u.id)
          ),
        );
      }
    }

    return jsonResponse({ ok: true, updated: count ?? 0, status });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
