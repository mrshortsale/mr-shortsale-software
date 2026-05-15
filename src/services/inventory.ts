import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';
import type { InventoryLead, InventorySource } from '@/data/inventoryLeads';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;
const SYNC_POLL_MS = 2500;
const SYNC_POLL_MAX_MS = 45 * 60 * 1000;

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

export interface InventorySyncRun {
  id: string;
  source: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  updated_at?: string;
  leads_upserted: number;
  lists_processed: number;
  error_message?: string | null;
  metadata?: {
    completed?: boolean;
    nextPage?: number | null;
    totalAvailable?: number;
    lastPage?: number;
  };
}

export interface InventorySyncStatus {
  batchConnected: boolean;
  batchLeadCount: number;
  syncInProgress?: boolean;
  canPause?: boolean;
  canResume?: boolean;
  canStop?: boolean;
  progress?: {
    completed: boolean;
    nextPage: number | null;
    totalAvailable: number | null;
    leadsInDb: number;
  } | null;
  lastRun: {
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    leads_upserted: number;
    error_message?: string | null;
    metadata?: {
      completed?: boolean;
      nextPage?: number | null;
      totalAvailable?: number;
    };
  } | null;
}

export interface InventorySyncResult {
  runId: string;
  leadsUpserted: number;
  pagesProcessed: number;
  lastPage: number;
  totalAvailable: number;
  completed: boolean;
  nextPage: number | null;
  backgroundContinuing?: boolean;
  durationMs: number;
  error?: string;
}

export interface InventoryStats {
  total: number;
  hot: number;
  triage: number;
  bySource: Record<InventorySource, number>;
}

export interface FetchInventoryParams {
  source?: InventorySource | 'All';
  state?: string;
  q?: string;
  minScore?: number;
  esOnly?: boolean;
  triageOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface FetchInventoryResult {
  leads: InventoryLead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getBatchSyncStatus(): Promise<{ data?: InventorySyncStatus; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/batchleads-sync`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to load sync status' };
    return { data };
  } catch {
    return { error: 'Network error' };
  }
}

export async function syncBatchLeads(options?: {
  startPage?: number;
  maxPages?: number;
  runId?: string;
  background?: boolean;
  force?: boolean;
  action?: 'sync' | 'resume';
}): Promise<{ result?: InventorySyncResult; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/batchleads-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'sync', background: true, ...options }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Sync failed' };
    return { result: data };
  } catch {
    return { error: 'Network error' };
  }
}

export async function resumeBatchLeads(runId?: string): Promise<{ result?: InventorySyncResult; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/batchleads-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'resume', background: true, runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Resume failed' };
    return { result: data };
  } catch {
    return { error: 'Network error' };
  }
}

export async function pauseBatchSync(runId?: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/batchleads-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'pause', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Pause failed' };
    return { ok: true };
  } catch {
    return { error: 'Network error' };
  }
}

export async function stopBatchSync(runId?: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/batchleads-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'stop', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Stop failed' };
    return { ok: true };
  } catch {
    return { error: 'Network error' };
  }
}

export async function listInventorySyncRuns(params?: {
  limit?: number;
  offset?: number;
  source?: string;
}): Promise<{ runs?: InventorySyncRun[]; total?: number; error?: string }> {
  try {
    const query = new URLSearchParams({ list: '1' });
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.source) query.set('source', params.source);

    const res = await fetch(`${BASE_URL}/batchleads-sync?${query}`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to load sync runs' };
    return { runs: data.runs, total: data.total };
  } catch {
    return { error: 'Network error' };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until sync finishes; server chains chunks in the background after the first POST. */
export async function waitForBatchSyncComplete(
  onProgress?: (status: InventorySyncStatus) => void,
): Promise<{ totalUpserted: number; completed: boolean; error?: string }> {
  const started = Date.now();

  while (Date.now() - started < SYNC_POLL_MAX_MS) {
    await delay(SYNC_POLL_MS);
    const { data, error } = await getBatchSyncStatus();
    if (error || !data) return { totalUpserted: 0, completed: false, error: error ?? 'Status unavailable' };

    onProgress?.(data);

    const run = data.lastRun;
    if (!run) return { totalUpserted: data.batchLeadCount, completed: true };

    if (run.status === 'success') {
      return { totalUpserted: data.batchLeadCount, completed: true };
    }

    if (run.status === 'failed') {
      return {
        totalUpserted: data.batchLeadCount,
        completed: false,
        error: run.error_message ?? 'Sync failed',
      };
    }

    if (run.status === 'stopped') {
      return {
        totalUpserted: data.batchLeadCount,
        completed: false,
        error: run.error_message ?? 'Sync stopped',
      };
    }

    if (run.status === 'paused' && !data.syncInProgress) {
      return {
        totalUpserted: data.batchLeadCount,
        completed: false,
        error: 'Sync paused',
      };
    }

    if (run.status === 'partial' && !data.syncInProgress) {
      const total = data.progress?.totalAvailable;
      const msg = total != null && data.batchLeadCount < total
        ? `Partial sync: ${data.batchLeadCount.toLocaleString()} of ~${total.toLocaleString()} leads. Click Continue sync.`
        : (run.error_message ?? 'Sync paused — click Continue sync');
      return { totalUpserted: data.batchLeadCount, completed: false, error: msg };
    }
  }

  return {
    totalUpserted: 0,
    completed: false,
    error: 'Sync is still running in the background. Refresh the page in a few minutes.',
  };
}

export async function syncBatchLeadsUntilComplete(
  onProgress?: (result: InventorySyncResult) => void,
  options?: { force?: boolean },
): Promise<{ totalUpserted: number; completed: boolean; error?: string }> {
  const { data: status } = await getBatchSyncStatus();
  const shouldResume = status?.canResume && status.lastRun?.status !== 'stopped' && !options?.force;
  const action = shouldResume ? 'resume' : 'sync';

  const { result, error } = action === 'resume'
    ? await resumeBatchLeads(status?.lastRun?.id)
    : await syncBatchLeads({ action: 'sync', force: options?.force ?? !shouldResume });

  if (error || !result) {
    return { totalUpserted: status?.batchLeadCount ?? 0, completed: false, error: error ?? 'Sync failed' };
  }

  onProgress?.(result);

  if (result.completed) {
    return { totalUpserted: result.leadsUpserted, completed: true };
  }

  return waitForBatchSyncComplete((s) => {
    if (s.lastRun && s.progress) {
      onProgress?.({
        runId: s.lastRun.id,
        leadsUpserted: s.progress.leadsInDb,
        pagesProcessed: 0,
        lastPage: 0,
        totalAvailable: s.progress.totalAvailable ?? 0,
        completed: s.progress.completed,
        nextPage: s.progress.nextPage,
        durationMs: 0,
      });
    }
  });
}

export async function fetchInventoryLeads(
  params: FetchInventoryParams = {},
): Promise<{
  leads?: InventoryLead[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  stats?: InventoryStats;
  lastSync?: InventorySyncStatus['lastRun'];
  error?: string;
}> {
  try {
    const query = new URLSearchParams();
    const source = params.source && params.source !== 'All' ? params.source : 'Batch';
    query.set('source', source);
    if (params.state && params.state !== 'All') query.set('state', params.state);
    if (params.q) query.set('q', params.q);
    if (params.minScore !== undefined) query.set('min_score', String(params.minScore));
    if (params.esOnly) query.set('es_only', 'true');
    if (params.triageOnly) query.set('triage_only', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));

    const res = await fetch(`${BASE_URL}/inventory-leads?${query}`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch inventory' };
    return {
      leads: data.leads,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
      stats: data.stats,
      lastSync: data.lastSync,
    };
  } catch {
    return { error: 'Network error' };
  }
}

export function formatLastSync(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatSyncProgress(status: InventorySyncStatus | undefined): string | null {
  if (!status?.lastRun) return null;
  const { lastRun, progress, syncInProgress } = status;
  if (lastRun.status === 'success') return null;
  if (syncInProgress || lastRun.status === 'running') {
    const total = progress?.totalAvailable;
    const n = progress?.leadsInDb ?? status.batchLeadCount;
    if (total != null) return `Syncing… ${n.toLocaleString()} / ~${total.toLocaleString()}`;
    return `Syncing… ${n.toLocaleString()} leads`;
  }
  if (lastRun.status === 'paused') {
    const total = progress?.totalAvailable;
    const n = progress?.leadsInDb ?? status.batchLeadCount;
    if (total != null) return `Paused at ${n.toLocaleString()} / ~${total.toLocaleString()} leads`;
    return `Paused at ${n.toLocaleString()} leads`;
  }
  if (lastRun.status === 'partial') {
    return `Interrupted at ${status.batchLeadCount.toLocaleString()} leads — resume to continue`;
  }
  if (lastRun.status === 'stopped') {
    return `Stopped at ${status.batchLeadCount.toLocaleString()} leads`;
  }
  return null;
}

export function syncStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    running: 'Running',
    success: 'Complete',
    failed: 'Failed',
    partial: 'Interrupted',
    paused: 'Paused',
    stopped: 'Stopped',
  };
  return labels[status] ?? status;
}

export function syncStatusTone(status: string): 'ok' | 'pending' | 'error' | 'muted' {
  if (status === 'success') return 'ok';
  if (status === 'running') return 'pending';
  if (status === 'failed') return 'error';
  if (status === 'paused' || status === 'partial') return 'pending';
  if (status === 'stopped') return 'muted';
  return 'muted';
}
