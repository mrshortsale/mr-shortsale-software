import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { decrypt } from "../_shared/crypto.ts";

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

async function getOpenAIKey(): Promise<string | null> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("slug", "openai")
    .single();

  if (!integration) return null;

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("encrypted_credentials, credentials_iv, status")
    .eq("integration_id", integration.id)
    .single();

  if (!cred || cred.status !== "connected") return null;

  try {
    const decrypted = await decrypt(cred.encrypted_credentials, cred.credentials_iv);
    const parsed = JSON.parse(decrypted) as Record<string, string>;
    return parsed.apiKey || parsed.api_key || null;
  } catch {
    return null;
  }
}

// Calls OpenAI Chat Completions with tool use support (Agents SDK pattern)
async function runAgentWithTools(
  apiKey: string,
  agentConfig: { name: string; instructions: string; model: string },
  userMessage: string,
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
  }>,
): Promise<{ output: string; tokenUsage: { prompt: number; completion: number; total: number } }> {
  const messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }> = [
    { role: "system", content: agentConfig.instructions },
    { role: "user", content: userMessage },
  ];

  const toolDefs = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  // Agent loop: keep running until no more tool calls
  for (let iteration = 0; iteration < 10; iteration++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: agentConfig.model,
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        tool_choice: toolDefs.length > 0 ? "auto" : undefined,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    totalPromptTokens += data.usage?.prompt_tokens || 0;
    totalCompletionTokens += data.usage?.completion_tokens || 0;

    const choice = data.choices[0];

    // Preserve tool_calls in the assistant message so subsequent tool responses are valid
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: choice.message.content ?? null,
        tool_calls: choice.message.tool_calls,
      } as unknown as { role: string; content: string });
    } else {
      messages.push({ role: choice.message.role, content: choice.message.content || "" });
    }

    // No tool calls — agent is done
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      return {
        output: choice.message.content || "",
        tokenUsage: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalPromptTokens + totalCompletionTokens,
        },
      };
    }

    // Execute all tool calls in this turn
    for (const toolCall of choice.message.tool_calls) {
      const toolDef = tools.find((t) => t.name === toolCall.function.name);
      let toolResult: string;

      if (!toolDef) {
        toolResult = JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
      } else {
        try {
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          toolResult = await toolDef.execute(args);
        } catch (e) {
          toolResult = JSON.stringify({ error: String(e) });
        }
      }

      messages.push({
        role: "tool",
        content: toolResult,
        tool_call_id: toolCall.id,
      });
    }
  }

  throw new Error("Agent loop exceeded maximum iterations");
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const ceoId = await requireCeo(req);
  if (!ceoId) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
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

  const leadLimit = Math.min(Math.max(parseInt(String(body.leadLimit || 10)), 1), 50);

  // Verify OpenAI is configured
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return jsonResponse({
      error: "OpenAI integration not connected. Go to Integrations, configure your API key, and test the connection.",
    }, 400);
  }

  // Load enabled agents in pipeline order
  const { data: agents, error: agentsErr } = await supabase
    .from("ai_agents")
    .select("*")
    .eq("is_enabled", true)
    .order("pipeline_order", { ascending: true });

  if (agentsErr || !agents || agents.length === 0) {
    return jsonResponse({ error: "No enabled agents found" }, 400);
  }

  // Create the run record
  const { data: run, error: runErr } = await supabase
    .from("agent_runs")
    .insert({ triggered_by: ceoId, lead_limit: leadLimit, status: "running" })
    .select()
    .single();

  if (runErr || !run) {
    return jsonResponse({ error: "Failed to create run record" }, 500);
  }

  const runId = run.id;

  // Define tools available to agents (closures over supabase + runId)
  const agentTools = {
    get_inventory_leads: {
      name: "get_inventory_leads",
      description: "Fetches distressed property leads from the inventory database",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of leads to fetch (max 50)" },
        },
        required: ["limit"],
      },
      execute: async (args: Record<string, unknown>) => {
        const limit = Math.min(Number(args.limit) || 10, 50);
        const { data } = await supabase
          .from("inventory_leads")
          .select("id, owner_name, address, city, state, phone, email, equity_pct, filing_type, auction_date, status, score, source, created_at")
          .neq("status", "Dismissed")
          .order("created_at", { ascending: false })
          .limit(limit);
        return JSON.stringify(data || []);
      },
    },

    update_lead_score: {
      name: "update_lead_score",
      description: "Persists an urgency score and reason for a lead in the database",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "The UUID of the lead" },
          score: { type: "number", description: "Score from 1 to 100" },
          reason: { type: "string", description: "Brief reason for the score" },
        },
        required: ["leadId", "score", "reason"],
      },
      execute: async (args: Record<string, unknown>) => {
        const { leadId, score, reason } = args as { leadId: string; score: number; reason: string };

        await supabase
          .from("inventory_leads")
          .update({ score: Math.round(score) })
          .eq("id", leadId);

        await supabase.from("lead_ai_results").upsert({
          run_id: runId,
          lead_id: leadId,
          score: Math.round(score),
          score_reason: reason,
        }, { onConflict: "run_id,lead_id" });

        return JSON.stringify({ success: true, leadId, score: Math.round(score) });
      },
    },

    save_lead_script: {
      name: "save_lead_script",
      description: "Saves a call script, skip-trace recommendation, or pass decision for a lead",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "The UUID of the lead" },
          decision: { type: "string", enum: ["script", "skip-trace", "pass"], description: "What action to take" },
          content: { type: "string", description: "The call script text, skip-trace notes, or pass reason" },
        },
        required: ["leadId", "decision", "content"],
      },
      execute: async (args: Record<string, unknown>) => {
        const { leadId, decision, content } = args as { leadId: string; decision: string; content: string };

        await supabase.from("lead_ai_results").upsert({
          run_id: runId,
          lead_id: leadId,
          decision,
          ...(decision === "script" ? { script: content } : { notes: content }),
        }, { onConflict: "run_id,lead_id" });

        return JSON.stringify({ success: true, leadId, decision });
      },
    },
  };

  // Tool sets per agent
  const toolsBySlug: Record<string, typeof agentTools[keyof typeof agentTools][]> = {
    "lead-hunter": [agentTools.get_inventory_leads],
    "research": [],
    "scoring": [agentTools.update_lead_score],
    "script-skip": [agentTools.save_lead_script],
  };

  // Run the pipeline sequentially
  let previousOutput = `Analyze the top ${leadLimit} distressed property leads from the inventory.`;
  const runSummary: Record<string, unknown> = {};

  try {
    for (const agent of agents) {
      const { data: logRow } = await supabase
        .from("agent_logs")
        .insert({
          run_id: runId,
          agent_id: agent.id,
          agent_slug: agent.slug,
          status: "running",
          input_summary: previousOutput.slice(0, 500),
        })
        .select()
        .single();

      const logId = logRow?.id;
      const startTime = Date.now();

      try {
        const tools = toolsBySlug[agent.slug] || [];
        const { output, tokenUsage } = await runAgentWithTools(
          apiKey,
          { name: agent.name, instructions: agent.instructions, model: agent.model },
          previousOutput,
          tools,
        );

        const durationMs = Date.now() - startTime;

        await supabase
          .from("agent_logs")
          .update({
            status: "completed",
            output_summary: output.slice(0, 2000),
            token_usage: tokenUsage,
            duration_ms: durationMs,
          })
          .eq("id", logId);

        runSummary[agent.slug] = { status: "completed", duration_ms: durationMs, tokens: tokenUsage.total };
        previousOutput = output;
      } catch (agentErr) {
        const errMsg = agentErr instanceof Error ? agentErr.message : String(agentErr);

        await supabase
          .from("agent_logs")
          .update({
            status: "failed",
            error_message: errMsg,
            duration_ms: Date.now() - startTime,
          })
          .eq("id", logId);

        await supabase
          .from("agent_runs")
          .update({ status: "failed", completed_at: new Date().toISOString(), error_message: `${agent.name} failed: ${errMsg}`, summary: runSummary })
          .eq("id", runId);

        return jsonResponse({ error: `Agent "${agent.name}" failed: ${errMsg}`, runId }, 500);
      }
    }

    await supabase
      .from("agent_runs")
      .update({ status: "completed", completed_at: new Date().toISOString(), summary: runSummary })
      .eq("id", runId);

    return jsonResponse({ success: true, runId, summary: runSummary });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("agent_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: errMsg })
      .eq("id", runId);

    return jsonResponse({ error: errMsg, runId }, 500);
  }
});
