import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!);

async function requireCeo(req: Request): Promise<boolean> {
  const token = (req.headers.get("x-auth-token") || req.headers.get("authorization"))?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return false;
    const { data } = await supabase.from("users").select("id, role, is_active").eq("id", payload.sub).single();
    return !!data && data.role === "ceo" && data.is_active;
  } catch { return false; }
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  if (!(await requireCeo(req))) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);

  if (req.method === "GET") {
    const { data, error } = await supabase.from("county_sources").select("*").order("name");
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ countySources: data ?? [] });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "runs") {
    let query = supabase.from("county_scrape_runs").select("*, county_sources(name, state)").order("started_at", { ascending: false }).limit(50);
    if (body.countySourceId) query = query.eq("county_source_id", body.countySourceId);
    const { data, error } = await query;
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ runs: data ?? [] });
  }

  if (action === "create") {
    const { data, error } = await supabase.from("county_sources").insert(body.data).select("*").single();
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ countySource: data });
  }

  if (action === "update") {
    const { data, error } = await supabase.from("county_sources").update({ ...body.data, updated_at: new Date().toISOString() }).eq("id", body.id).select("*").single();
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ countySource: data });
  }

  if (action === "delete") {
    const { error } = await supabase.from("county_sources").delete().eq("id", body.id);
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
