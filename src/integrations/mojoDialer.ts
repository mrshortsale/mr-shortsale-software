import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from '@/services/auth';
import type { RealtorAgent } from '@/services/realtor';

export type MojoOutcome = 'Answered' | 'Voicemail' | 'No Answer' | 'DNC' | 'Interested' | 'Callback Scheduled';

export interface MojoQueueStatus {
  queued: number;
  callsToday: number;
  connectRate: number; // 0-100
  lastSync: string;
}

export interface MojoPushResult {
  ok: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

export async function getMojoStatus(): Promise<MojoQueueStatus> {
  return {
    queued: 47,
    callsToday: 128,
    connectRate: 31,
    lastSync: '5 min ago',
  };
}

/**
 * Push one or more realtor agents to Mojo Dialer via the Zapier catch-hook webhook.
 * The webhook URL is stored encrypted in integration_credentials for the mojo-dialer integration.
 */
export async function sendToMojo(agents: RealtorAgent[]): Promise<MojoPushResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mojo-push`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ agents }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, sent: 0, failed: agents.length, errors: [err.error ?? `HTTP ${res.status}`] };
    }

    const data = await res.json() as MojoPushResult;
    return data;
  } catch (e) {
    return { ok: false, sent: 0, failed: agents.length, errors: [(e as Error).message] };
  }
}

export async function logMojoOutcome(leadId: string, outcome: MojoOutcome, callbackAt?: string) {
  return { ok: true, leadId, outcome, callbackAt };
}
