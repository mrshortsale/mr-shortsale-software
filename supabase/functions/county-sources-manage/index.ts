import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!);

async function requireCeo(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return null;
    const { data } = await supabase.from("users").select("id, role, is_active").eq("id", payload.sub).single();
    return data?.role === "ceo" && data.is_active ? data.id : null;
  } catch { return null; }
}

const editableFields = ["name", "state", "county_fips", "scrape_url", "scrape_method", "apify_actor_id", "is_active", "schedule", "notes"];
function pickFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of editableFields) if (key in body) out[key] = body[key] === "" ? null : body[key];
  return out;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (!await requireCeo(req)) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "runs") {
      let q = supabase.from("county_scrape_runs").select("*, county_sources(name)").order("started_at", { ascending: false }).limit(50);
      const sourceId = url.searchParams.get("county_source_id");
      if (sourceId) q = q.eq("county_source_id", sourceId);
      const { data, error } = await q;
      if (error) return jsonResponse({ error: "Failed to fetch scrape runs" }, 500);
      return jsonResponse({ runs: data ?? [] });
    }
    const { data, error } = await supabase.from("county_sources").select("*").order("created_at", { ascending: false });
    if (error) return jsonResponse({ error: "Failed to fetch county sources" }, 500);
    return jsonResponse({ sources: data ?? [] });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonResponse({ error: "Invalid JSON body" }, 400);

  if (body.action === "create") {
    const fields = pickFields(body);
    if (!fields.name || !fields.scrape_url) return jsonResponse({ error: "County name and scrape URL are required" }, 400);
    const { data, error } = await supabase.from("county_sources").insert(fields).select().single();
    if (error) return jsonResponse({ error: "Failed to create county source" }, 500);
    return jsonResponse({ source: data }, 201);
  }
  if (body.action === "update") {
    if (!body.id) return jsonResponse({ error: "id is required" }, 400);
    const { data, error } = await supabase.from("county_sources").update(pickFields(body)).eq("id", body.id).select().single();
    if (error) return jsonResponse({ error: "Failed to update county source" }, 500);
    return jsonResponse({ source: data });
  }
  if (body.action === "delete") {
    if (!body.id) return jsonResponse({ error: "id is required" }, 400);
    const { error } = await supabase.from("county_sources").delete().eq("id", body.id);
    if (error) return jsonResponse({ error: "Failed to delete county source" }, 500);
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: "Unknown action" }, 400);
});
