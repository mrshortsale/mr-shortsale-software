// Mojo Triple Dialer integration (mock)
export type MojoOutcome = 'Answered' | 'Voicemail' | 'No Answer' | 'DNC' | 'Interested' | 'Callback Scheduled';

export interface MojoQueueStatus {
  queued: number;
  callsToday: number;
  connectRate: number; // 0-100
  lastSync: string;
}

export async function getMojoStatus(): Promise<MojoQueueStatus> {
  return {
    queued: 47,
    callsToday: 128,
    connectRate: 31,
    lastSync: '5 min ago',
  };
}

export async function sendToMojo(leadIds: string[]) {
  return { ok: true, queued: leadIds.length };
}

export async function logMojoOutcome(leadId: string, outcome: MojoOutcome, callbackAt?: string) {
  return { ok: true, leadId, outcome, callbackAt };
}
