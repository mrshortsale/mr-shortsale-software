import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

export interface AIAgent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  instructions: string;
  model: string;
  is_enabled: boolean;
  pipeline_order: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  triggered_by: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  lead_limit: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  summary: Record<string, unknown> | null;
}

export interface AgentLog {
  id: string;
  run_id: string;
  agent_id: string;
  agent_slug: string;
  status: 'running' | 'completed' | 'failed';
  input_summary: string | null;
  output_summary: string | null;
  token_usage: { prompt: number; completion: number; total: number } | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export async function listAgents(): Promise<{ agents?: AIAgent[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/ai-agents-manage`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch agents' };
    return { agents: data.agents };
  } catch {
    return { error: 'Network error' };
  }
}

export async function updateAgent(
  agentId: string,
  fields: Partial<Pick<AIAgent, 'name' | 'description' | 'instructions' | 'model' | 'is_enabled' | 'config'>>,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/ai-agents-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'update_agent', agentId, fields }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update agent' };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function runPipeline(
  leadLimit: number,
): Promise<{ runId?: string; summary?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/ai-agent-pipeline`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ leadLimit }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Pipeline failed', runId: data.runId };
    return { runId: data.runId, summary: data.summary };
  } catch {
    return { error: 'Network error' };
  }
}

export async function listRuns(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ runs?: AgentRun[]; total?: number; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    query.set('resource', 'runs');

    const res = await fetch(`${BASE_URL}/ai-agents-manage?${query.toString()}`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch runs' };
    return { runs: data.runs, total: data.total };
  } catch {
    return { error: 'Network error' };
  }
}

export async function listLogs(params?: {
  runId?: string;
  agentSlug?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs?: AgentLog[]; total?: number; error?: string }> {
  try {
    const query = new URLSearchParams();
    query.set('resource', 'logs');
    if (params?.runId) query.set('runId', params.runId);
    if (params?.agentSlug) query.set('agentSlug', params.agentSlug);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await fetch(`${BASE_URL}/ai-agents-manage?${query.toString()}`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch logs' };
    return { logs: data.logs, total: data.total };
  } catch {
    return { error: 'Network error' };
  }
}
