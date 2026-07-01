import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;

export const SHEET_TAB_NAMES = [
  'AD Leads',
  'New Campaign Leads',
  'Updated Leads',
  'realtors',
] as const;

export type SheetTabName = (typeof SHEET_TAB_NAMES)[number];

export interface SheetLead {
  id: string;
  tab: string | null;
  leadId: string | null;
  owner: string;
  phone: string | null;
  email: string | null;
  city: string;
  state: string;
  address: string;
  campaignName: string | null;
  adsetName: string | null;
  creative: string | null;
  formType: string | null;
  intent: string | null;
  platform: string | null;
  leadType: string;
  status: string;
  assignedRepId: string | null;
  assignedRepName: string | null;
  receivedAt: number;
  ingestedAt: number | null;
}

export interface SheetLeadMetrics {
  counts: Record<string, number>;
  totalToday: number;
  tabs: string[];
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

export async function fetchSheetLeads(
  tab?: string | null,
  limit = 50,
): Promise<{ leads?: SheetLead[]; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (tab) query.set('tab', tab);
    query.set('limit', String(limit));

    const res = await fetch(`${BASE_URL}/sheets-leads?${query}`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch sheet leads' };
    return { leads: data.leads ?? [] };
  } catch {
    return { error: 'Network error' };
  }
}

export async function fetchSheetLeadMetrics(): Promise<{
  metrics?: SheetLeadMetrics;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/sheets-leads?action=metrics`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch metrics' };
    return {
      metrics: {
        counts: data.counts ?? {},
        totalToday: data.totalToday ?? 0,
        tabs: data.tabs ?? [],
      },
    };
  } catch {
    return { error: 'Network error' };
  }
}

const POLL_MS = 15_000;

/**
 * Polls for newly ingested sheet leads. Direct Supabase Realtime is not used
 * because inventory_leads is service-role only (RLS deny_all_direct_access).
 */
export function subscribeSheetLeads(
  tab: string | null,
  onInsert: (lead: SheetLead) => void,
): () => void {
  const knownIds = new Set<string>();
  let latestReceivedAt = 0;
  let stopped = false;

  const seed = async () => {
    const { leads } = await fetchSheetLeads(tab, 50);
    for (const lead of leads ?? []) {
      knownIds.add(lead.id);
      if (lead.receivedAt > latestReceivedAt) latestReceivedAt = lead.receivedAt;
    }
  };

  const poll = async () => {
    if (stopped) return;
    const query = new URLSearchParams();
    if (tab) query.set('tab', tab);
    query.set('limit', '20');
    if (latestReceivedAt > 0) query.set('since', String(latestReceivedAt));

    try {
      const res = await fetch(`${BASE_URL}/sheets-leads?${query}`, {
        method: 'GET',
        headers: authedHeaders(),
      });
      const data = await res.json();
      const leads: SheetLead[] = data.leads ?? [];
      for (const lead of leads.sort((a, b) => a.receivedAt - b.receivedAt)) {
        if (!knownIds.has(lead.id)) {
          knownIds.add(lead.id);
          onInsert(lead);
        }
        if (lead.receivedAt > latestReceivedAt) latestReceivedAt = lead.receivedAt;
      }
    } catch {
      // ignore transient poll errors
    }
  };

  void seed().then(() => {
    if (stopped) return;
    void poll();
  });

  const interval = window.setInterval(() => {
    void poll();
  }, POLL_MS);

  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}

export function leadDisplaySubtitle(lead: SheetLead): string {
  if (lead.campaignName) return lead.campaignName;
  if (lead.intent) return lead.intent.replace(/_/g, ' ');
  if (lead.city && lead.state) return `${lead.city}, ${lead.state}`;
  if (lead.tab) return lead.tab;
  return 'Google Sheets lead';
}
