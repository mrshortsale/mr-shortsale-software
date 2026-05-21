import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

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

    if (!data || data.role !== "ceo" || !data.is_active) return null;
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
  const resource = url.searchParams.get("resource");

  // GET /ai-agents-manage — list agents
  if (req.method === "GET" && !resource) {
    const { data: agents, error } = await supabase
      .from("ai_agents")
      .select("*")
      .order("pipeline_order", { ascending: true });

    if (error) return jsonResponse({ error: "Failed to fetch agents" }, 500);
    return jsonResponse({ agents: agents || [] });
  }

  // GET /ai-agents-manage?resource=runs — list pipeline runs
  if (req.method === "GET" && resource === "runs") {
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const { data: runs, count, error } = await supabase
      .from("agent_runs")
      .select("*", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return jsonResponse({ error: "Failed to fetch runs" }, 500);
    return jsonResponse({ runs: runs || [], total: count || 0 });
  }

  // GET /ai-agents-manage?resource=logs — list all logs (or filtered by runId)
  if (req.method === "GET" && resource === "logs") {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const runId = url.searchParams.get("runId");
    const agentSlug = url.searchParams.get("agentSlug");

    let query = supabase
      .from("agent_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (runId) query = query.eq("run_id", runId);
    if (agentSlug) query = query.eq("agent_slug", agentSlug);

    const { data: logs, count, error } = await query;
    if (error) return jsonResponse({ error: "Failed to fetch logs" }, 500);
    return jsonResponse({ logs: logs || [], total: count || 0 });
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

  // Update agent configuration
  if (action === "update_agent") {
    const { agentId, fields } = body as {
      agentId?: string;
      fields?: Partial<{
        name: string;
        description: string;
        instructions: string;
        model: string;
        is_enabled: boolean;
        config: Record<string, unknown>;
      }>;
    };

    if (!agentId) return jsonResponse({ error: "agentId is required" }, 400);
    if (!fields || Object.keys(fields).length === 0) return jsonResponse({ error: "No fields to update" }, 400);

    const allowed = ["name", "description", "instructions", "model", "is_enabled", "config"];
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) updates[k] = v;
    }

    const { error } = await supabase
      .from("ai_agents")
      .update(updates)
      .eq("id", agentId);

    if (error) return jsonResponse({ error: "Failed to update agent" }, 500);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
});
