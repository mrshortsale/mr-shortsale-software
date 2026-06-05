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

async function post<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/integrations-manage`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MlsSyncProfile {
  id: string;
  integration_id: string;
  dataset_id: string;
  display_name: string;
  enabled: boolean;
  state_allowlist: string[];
  keyword_filters: string[];
  condition_filters: string[];
  odata_filter_override: string | null;
  select_fields: string[];
  page_size: number;
  sort_order: string;
  last_tested_at: string | null;
  last_test_status: 'success' | 'failure' | null;
  last_test_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MlsDataset {
  id: string;
  name: string;
  recordCount?: number;
}

export interface MlsTestResult {
  success: boolean;
  latency_ms: number;
  sample: Record<string, unknown> | null;
  error: string | null;
}

export interface MlsProfileUpdate {
  displayName?: string;
  enabled?: boolean;
  stateAllowlist?: string[];
  keywordFilters?: string[];
  conditionFilters?: string[];
  odataFilterOverride?: string | null;
  selectFields?: string[];
  pageSize?: number;
  sortOrder?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function listMlsProfiles(): Promise<{ profiles: MlsSyncProfile[]; error: string | null }> {
  try {
    const data = await post<{ profiles: MlsSyncProfile[] }>('list_mls_profiles');
    return { profiles: data.profiles, error: null };
  } catch (e) {
    return { profiles: [], error: (e as Error).message };
  }
}

export async function createMlsProfile(
  datasetId: string,
  displayName?: string,
): Promise<{ profile: MlsSyncProfile | null; error: string | null }> {
  try {
    const data = await post<{ profile: MlsSyncProfile }>('create_mls_profile', { datasetId, displayName });
    return { profile: data.profile, error: null };
  } catch (e) {
    return { profile: null, error: (e as Error).message };
  }
}

export async function updateMlsProfile(
  profileId: string,
  updates: MlsProfileUpdate,
): Promise<{ profile: MlsSyncProfile | null; error: string | null }> {
  try {
    const data = await post<{ profile: MlsSyncProfile }>('update_mls_profile', { profileId, ...updates });
    return { profile: data.profile, error: null };
  } catch (e) {
    return { profile: null, error: (e as Error).message };
  }
}

export async function deleteMlsProfile(
  profileId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await post<{ success: boolean }>('delete_mls_profile', { profileId });
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function testMlsProfile(
  profileId: string,
): Promise<{ result: MlsTestResult | null; error: string | null }> {
  try {
    const data = await post<MlsTestResult>('test_mls_profile', { profileId });
    return { result: data, error: null };
  } catch (e) {
    return { result: null, error: (e as Error).message };
  }
}

export async function discoverMlsDatasets(): Promise<{ datasets: MlsDataset[]; error: string | null }> {
  try {
    const data = await post<{ datasets: MlsDataset[] }>('discover_mls_datasets');
    return { datasets: data.datasets, error: null };
  } catch (e) {
    return { datasets: [], error: (e as Error).message };
  }
}

// ─── Sync controls (calls bridge-mls-sync) ────────────────────────────────────

export interface MlsSyncStatus {
  bridgeConnected: boolean;
  profiles: ProfileSyncState[];
}

export interface ProfileSyncState {
  id: string;
  datasetId: string;
  displayName: string;
  enabled: boolean;
  syncInProgress: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  agentsInDb: number;
  lastRun: MlsSyncRun | null;
}

export interface MlsSyncRun {
  id: string;
  profile_id: string;
  dataset_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  leads_upserted: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

async function syncPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}/bridge-mls-sync`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getMlsSyncStatus(): Promise<{ data: MlsSyncStatus | null; error: string | null }> {
  try {
    const res = await fetch(`${BASE_URL}/bridge-mls-sync`, { headers: authedHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { data: null, error: err.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as MlsSyncStatus;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export async function startMlsSync(
  opts: { profileId?: string; mode?: 'full' | 'incremental'; force?: boolean } = {},
): Promise<{ data: unknown; error: string | null }> {
  try {
    const data = await syncPost({ action: 'sync', background: true, ...opts });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export async function pauseMlsSync(runId: string): Promise<{ error: string | null }> {
  try {
    await syncPost({ action: 'pause', runId });
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function resumeMlsSync(runId: string): Promise<{ error: string | null }> {
  try {
    await syncPost({ action: 'resume', runId });
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function stopMlsSync(runId: string): Promise<{ error: string | null }> {
  try {
    await syncPost({ action: 'stop', runId });
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function listMlsSyncRuns(
  opts: { profileId?: string; limit?: number; offset?: number } = {},
): Promise<{ runs: MlsSyncRun[]; total: number; error: string | null }> {
  try {
    const data = await syncPost<{ runs: MlsSyncRun[]; total: number }>({ action: 'list', ...opts });
    return { runs: data.runs, total: data.total, error: null };
  } catch (e) {
    return { runs: [], total: 0, error: (e as Error).message };
  }
}
