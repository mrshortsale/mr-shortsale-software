import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { verifyJwt } from "../_shared/jwt.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const editableFields = [
  "name",
  "state",
  "county_fips",
  "scrape_url",
  "scrape_method",
  "apify_actor_id",
  "is_active",
  "schedule",
  "notes",
] as const;

type EditableField = typeof editableFields[number];

async function requireCeo(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("x-auth-token") || req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return null;

    const { data } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", payload.sub)
      .single();

    return data?.role === "ceo" && data.is_active ? data.id : null;
  } catch {
    return null;
  }
}

function normalizeValue(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function pickCountySourceFields(body: Record<string, unknown>): Partial<Record<EditableField, unknown>> {
  const fields: Partial<Record<EditableField, unknown>> = {};
  for (const key of editableFields) {
    if (key in body) fields[key] = normalizeValue(body[key]);
  }
  return fields;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!await requireCeo(req)) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  if (req.method === "GET") {
    const url = new URL(req.url);

    if (url.searchParams.get("action") === "runs") {
      let query = supabase
        .from("county_scrape_runs")
        .select("*, county_sources(name)")
        .order("started_at", { ascending: false })
        .limit(50);

      const countySourceId = url.searchParams.get("county_source_id");
      if (countySourceId) query = query.eq("county_source_id", countySourceId);

      const { data, error } = await query;
      if (error) return jsonResponse({ error: "Failed to fetch scrape runs" }, 500);
      return jsonResponse({ runs: data ?? [] });
    }

    const { data, error } = await supabase
      .from("county_sources")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return jsonResponse({ error: "Failed to fetch county sources" }, 500);
    return jsonResponse({ sources: data ?? [] });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = await readJson(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body" }, 400);

  if (body.action === "create") {
    const fields = pickCountySourceFields(body);
    if (!fields.name || !fields.scrape_url) {
      return jsonResponse({ error: "County name and scrape URL are required" }, 400);
    }

    const { data, error } = await supabase
      .from("county_sources")
      .insert(fields)
      .select()
      .single();

    if (error) return jsonResponse({ error: "Failed to create county source" }, 500);
    return jsonResponse({ source: data }, 201);
  }

  if (body.action === "update") {
    if (!body.id || typeof body.id !== "string") return jsonResponse({ error: "id is required" }, 400);

    const { data, error } = await supabase
      .from("county_sources")
      .update(pickCountySourceFields(body))
      .eq("id", body.id)
      .select()
      .single();

    if (error) return jsonResponse({ error: "Failed to update county source" }, 500);
    return jsonResponse({ source: data });
  }

  if (body.action === "delete") {
    if (!body.id || typeof body.id !== "string") return jsonResponse({ error: "id is required" }, 400);

    const { error } = await supabase.from("county_sources").delete().eq("id", body.id);
    if (error) return jsonResponse({ error: "Failed to delete county source" }, 500);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
