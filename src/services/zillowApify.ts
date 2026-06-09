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

export type ZillowLeadStatus = 'New' | 'Contacted' | 'Partnered' | 'Closed Won' | 'Declined';

export interface ZillowSyncProfile {
  id: string;
  integration_id: string;
  display_name: string;
  enabled: boolean;
  search_url: string;
  search_config: Record<string, unknown>;
  max_listings: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZillowSyncRun {
  id: string;
  profile_id: string;
  status: 'running' | 'success' | 'failed' | 'partial' | 'paused' | 'stopped';
  started_at: string;
  completed_at: string | null;
  listings_scraped: number;
  agents_upserted: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface ZillowAgentLead {
  id: string;
  profileId: string;
  datasetId: string;
  externalId: string;
  agentName: string;
  brokerage: string;
  agentPhone: string;
  agentEmail: string;
  brokerPhone: string;
  mlsName: string;
  isListedByOwner: boolean;
  trueStatus: string | null;
  listingCount: number;
  latestZpid: string | null;
  latestDetailUrl: string | null;
  latestPropertyAddress: string | null;
  latestCity: string | null;
  latestState: string | null;
  latestListPrice: number | null;
  latestDaysOnMarket: number | null;
  status: ZillowLeadStatus;
  assignedRep: string | null;
  lastContactAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ZillowStats {
  total: number;
  newToday: number;
  hotLeads: number;
  awaitingFollowup: number;
  lastSyncAt: string | null;
}

export interface SearchConfig {
  rawUrl?: string;
  state?: string;
  regionId?: string;
  listingType?: 'forSale' | 'forRent' | 'sold';
  shortSaleOnly?: boolean;
  foreclosureOnly?: boolean;
  daysOnZillow?: number;
  priceMin?: number;
  priceMax?: number;
}

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

export async function listZillowProfiles(): Promise<{
  profiles: ZillowSyncProfile[];
  integrationId: string | null;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'LIST_PROFILES' }),
    });
    const data = await res.json();
    if (!res.ok) return { profiles: [], integrationId: null, error: data.error };
    return { profiles: data.profiles ?? [], integrationId: data.integrationId ?? null };
  } catch {
    return { profiles: [], integrationId: null, error: 'Network error' };
  }
}

export async function createZillowProfile(payload: {
  displayName: string;
  searchUrl?: string;
  searchConfig?: SearchConfig;
  maxListings?: number;
  enabled?: boolean;
}): Promise<{ profile?: ZillowSyncProfile; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'CREATE_PROFILE', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { profile: data.profile };
  } catch {
    return { error: 'Network error' };
  }
}

export async function updateZillowProfile(payload: {
  profileId: string;
  displayName?: string;
  searchUrl?: string;
  searchConfig?: SearchConfig;
  maxListings?: number;
  enabled?: boolean;
}): Promise<{ profile?: ZillowSyncProfile; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'UPDATE_PROFILE', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { profile: data.profile };
  } catch {
    return { error: 'Network error' };
  }
}

export async function deleteZillowProfile(
  profileId: string,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'DELETE_PROFILE', profileId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function buildZillowSearchUrl(
  searchConfig: SearchConfig,
): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-manage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'BUILD_SEARCH_URL', searchConfig }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { url: data.url };
  } catch {
    return { error: 'Network error' };
  }
}

// ─── Sync controls ────────────────────────────────────────────────────────────

export async function startZillowSync(profileId: string): Promise<{
  runId?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'sync', profileId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { runId: data.runId };
  } catch {
    return { error: 'Network error' };
  }
}

export async function pauseZillowSync(
  runId: string,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'pause', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function stopZillowSync(
  runId: string,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'stop', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function fetchZillowSyncStatus(): Promise<{
  profiles: ZillowSyncProfile[];
  recentRuns: ZillowSyncRun[];
  totalLeads: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-sync`, {
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { profiles: [], recentRuns: [], totalLeads: 0, error: data.error };
    return {
      profiles: data.profiles ?? [],
      recentRuns: data.recentRuns ?? [],
      totalLeads: data.totalLeads ?? 0,
    };
  } catch {
    return { profiles: [], recentRuns: [], totalLeads: 0, error: 'Network error' };
  }
}

export async function collectZillowAgents(
  runId: string,
): Promise<{ processed?: number; stillPending?: number; done?: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'collect_agents', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { processed: data.processed, stillPending: data.stillPending, done: data.done };
  } catch {
    return { error: 'Network error' };
  }
}

export async function listZillowSyncRuns(
  profileId?: string,
): Promise<{ runs: ZillowSyncRun[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'list', profileId }),
    });
    const data = await res.json();
    if (!res.ok) return { runs: [], error: data.error };
    return { runs: data.runs ?? [] };
  } catch {
    return { runs: [], error: 'Network error' };
  }
}

// ─── Leads API ────────────────────────────────────────────────────────────────

export interface FetchZillowLeadsOptions {
  profileId?: string;
  state?: string;
  statuses?: ZillowLeadStatus[];
  hotOnly?: boolean;
  assignedRep?: string | 'unassigned';
  q?: string;
  limit?: number;
  offset?: number;
}

export async function fetchZillowLeads(opts: FetchZillowLeadsOptions = {}): Promise<{
  leads: ZillowAgentLead[];
  total: number;
  stats: ZillowStats;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (opts.profileId) params.set('profile_id', opts.profileId);
  if (opts.state) params.set('state', opts.state);
  if (opts.statuses?.length) params.set('status', opts.statuses.join(','));
  if (opts.hotOnly) params.set('hot_only', 'true');
  if (opts.assignedRep) params.set('assigned_rep', opts.assignedRep);
  if (opts.q) params.set('q', opts.q);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));

  try {
    const res = await fetch(`${BASE_URL}/zillow-realtor-leads?${params}`, {
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      return { leads: [], total: 0, stats: { total: 0, newToday: 0, hotLeads: 0, awaitingFollowup: 0, lastSyncAt: null }, error: data.error };
    }
    return { leads: data.leads ?? [], total: data.total ?? 0, stats: data.stats };
  } catch {
    return { leads: [], total: 0, stats: { total: 0, newToday: 0, hotLeads: 0, awaitingFollowup: 0, lastSyncAt: null }, error: 'Network error' };
  }
}

export async function patchZillowLead(payload: {
  id: string;
  status?: ZillowLeadStatus;
  notes?: string;
  lastContactAt?: string | null;
  assignedRep?: string | null;
}): Promise<{ lead?: ZillowAgentLead; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-realtor-leads`, {
      method: 'PATCH',
      headers: authedHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { lead: data.lead };
  } catch {
    return { error: 'Network error' };
  }
}

export async function roundRobinAssignZillowLeads(): Promise<{
  assigned?: number;
  repCount?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/zillow-realtor-leads`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'round_robin_assign' }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { assigned: data.assigned, repCount: data.repCount };
  } catch {
    return { error: 'Network error' };
  }
}
