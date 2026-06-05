import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RealtorLeadStatus = 'New' | 'Contacted' | 'Partnered' | 'Closed Won' | 'Declined';

export interface RealtorAgent {
  id: string;
  profileId: string;
  datasetId: string;
  externalId: string;
  listAgentKey: string | null;
  agentName: string;
  brokerage: string;
  agentPhone: string;
  agentEmail: string;
  language: 'EN' | 'ES';
  listingCount: number;
  latestListingId: string;
  latestPropertyAddress: string;
  latestCity: string;
  latestState: string;
  latestListPrice: number;
  latestDaysOnMarket: number;
  latestPublicRemarks: string;
  status: RealtorLeadStatus;
  lastContactAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RealtorStats {
  total: number;
  newToday: number;
  hotLeads: number;
  awaitingFollowup: number;
  lastSyncAt: string | null;
}

export interface FetchRealtorLeadsOptions {
  profileId?: string;
  datasetId?: string;
  state?: string;
  language?: string;
  statuses?: RealtorLeadStatus[];
  hotOnly?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchRealtorLeads(opts: FetchRealtorLeadsOptions = {}): Promise<{
  leads: RealtorAgent[];
  total: number;
  stats: RealtorStats;
  error: string | null;
}> {
  try {
    const params = new URLSearchParams();
    if (opts.profileId) params.set('profile_id', opts.profileId);
    if (opts.datasetId) params.set('dataset_id', opts.datasetId);
    if (opts.state) params.set('state', opts.state);
    if (opts.language) params.set('language', opts.language);
    if (opts.statuses?.length) params.set('status', opts.statuses.join(','));
    if (opts.hotOnly) params.set('hot_only', 'true');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));

    const res = await fetch(`${BASE_URL}/realtor-leads?${params}`, {
      headers: authedHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { leads: [], total: 0, stats: emptyStats(), error: err.error ?? `HTTP ${res.status}` };
    }

    const data = await res.json() as { leads: RealtorAgent[]; total: number; stats: RealtorStats };
    return { leads: data.leads, total: data.total, stats: data.stats, error: null };
  } catch (e) {
    return { leads: [], total: 0, stats: emptyStats(), error: (e as Error).message };
  }
}

export async function updateRealtorLeadStatus(
  id: string,
  status: RealtorLeadStatus,
): Promise<{ lead: RealtorAgent | null; error: string | null }> {
  return patchLead(id, { status });
}

export async function updateRealtorLead(
  id: string,
  fields: { status?: RealtorLeadStatus; notes?: string; lastContactAt?: string | null },
): Promise<{ lead: RealtorAgent | null; error: string | null }> {
  return patchLead(id, fields);
}

async function patchLead(
  id: string,
  fields: Record<string, unknown>,
): Promise<{ lead: RealtorAgent | null; error: string | null }> {
  try {
    const res = await fetch(`${BASE_URL}/realtor-leads`, {
      method: 'PATCH',
      headers: authedHeaders(),
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { lead: null, error: err.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as { lead: RealtorAgent };
    return { lead: data.lead, error: null };
  } catch (e) {
    return { lead: null, error: (e as Error).message };
  }
}

export function isHotAgent(agent: RealtorAgent): boolean {
  return agent.listingCount >= 2 || agent.latestDaysOnMarket >= 90;
}

function emptyStats(): RealtorStats {
  return { total: 0, newToday: 0, hotLeads: 0, awaitingFollowup: 0, lastSyncAt: null };
}
