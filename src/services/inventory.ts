import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';
import {
  PIPELINE_STAGES,
  type InventoryLead,
  type InventorySource,
  type InventoryStatus,
  type InventoryFilingType,
  type PipelineStage,
} from '@/data/inventoryLeads';

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

export type SyncMode = 'full' | 'incremental';

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
    mode?: SyncMode;
    since?: string | null;
    cumulativeNew?: number;
    cumulativeUpdated?: number;
    pagesProcessedTotal?: number;
  };
}

export interface InventorySyncStatus {
  batchConnected: boolean;
  /** Total Batch leads currently in the database. */
  leadsInDb: number;
  /** @deprecated use leadsInDb */
  batchLeadCount?: number;
  /** True when a prior successful sync run exists (required for incremental). */
  hasIncrementalBaseline?: boolean;
  lastRunMode?: SyncMode;
  syncInProgress?: boolean;
  canPause?: boolean;
  canResume?: boolean;
  canStop?: boolean;
  progress?: {
    completed: boolean;
    nextPage: number | null;
    /** Total leads in Batch matching the current query (not a progress denominator for incremental). */
    totalAvailable: number | null;
    leadsInDb: number;
    cumulativeNew: number;
    cumulativeUpdated: number;
    pagesProcessedTotal: number;
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
      mode?: SyncMode;
      cumulativeNew?: number;
      cumulativeUpdated?: number;
      pagesProcessedTotal?: number;
    };
  } | null;
}

export interface InventorySyncResult {
  runId: string;
  mode?: SyncMode;
  /** Total Batch leads in the database after this chunk. */
  leadsInDb: number;
  /** New leads added in this background chunk only. */
  chunkNew: number;
  /** Existing leads updated in this background chunk only. */
  chunkUpdated: number;
  /** Cumulative new leads across all chunks of this run. */
  cumulativeNew: number;
  /** Cumulative updated leads across all chunks of this run. */
  cumulativeUpdated: number;
  pagesProcessed: number;
  pagesProcessedTotal: number;
  lastPage: number;
  totalAvailable: number;
  completed: boolean;
  nextPage: number | null;
  backgroundContinuing?: boolean;
  durationMs: number;
  error?: string;
}

export interface InventoryStats {
  /** Total leads for the active source (used as the funnel banner denominator). */
  sourceTotal: number;
  /** Leads with ingested_at >= start of today. */
  newToday: number;
  /** Average contact_attempts among New + Contacted leads. */
  avgAttempts: number;
  /** Distressed-equity leads: equity_pct <= 25 (excluding Dismissed). */
  hotEquity: number;
  /** Leads with days_to_auction < 30 (excluding Dismissed). */
  auctionsLt30: number;
  /** Leads with score >= 8 (excluding Dismissed). */
  hotScore: number;
  bySource: Record<InventorySource, number>;
}

export interface FetchInventoryParams {
  source?: InventorySource | 'All';
  state?: string;
  q?: string;
  minScore?: number;
  esOnly?: boolean;
  statuses?: InventoryStatus[];
  filingTypes?: InventoryFilingType[];
  assignedRep?: string | 'unassigned' | null;
  /** Lower bound (inclusive) on equity_pct. */
  minEquity?: number;
  /** Upper bound (inclusive) on equity_pct. Use 25 for distressed-only. */
  maxEquity?: number;
  limit?: number;
  offset?: number;
  pipelineOnly?: boolean;
  pipelineStage?: PipelineStage;
}

export function resolvePipelineStage(lead: InventoryLead): PipelineStage {
  if (lead.pipelineStage) return lead.pipelineStage;
  if (lead.status === 'Promoted') return 'Bank Submitted';
  if (lead.status === 'Contacted') return 'Initial Contact';
  return 'Initial Contact';
}

export interface InventoryRep {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
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
    const raw = await res.json();
    if (!res.ok) return { error: raw.error ?? 'Failed to load sync status' };
    // Normalise: server now sends leadsInDb; keep batchLeadCount alias for any consumers not yet updated
    const data: InventorySyncStatus = {
      ...raw,
      leadsInDb: raw.leadsInDb ?? raw.batchLeadCount ?? 0,
      batchLeadCount: raw.leadsInDb ?? raw.batchLeadCount ?? 0,
    };
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
  mode?: SyncMode;
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
): Promise<{ leadsInDb: number; completed: boolean; error?: string }> {
  const started = Date.now();

  while (Date.now() - started < SYNC_POLL_MAX_MS) {
    await delay(SYNC_POLL_MS);
    const { data, error } = await getBatchSyncStatus();
    if (error || !data) return { leadsInDb: 0, completed: false, error: error ?? 'Status unavailable' };

    onProgress?.(data);

    const leadsInDb = data.leadsInDb;
    const run = data.lastRun;
    if (!run) return { leadsInDb, completed: true };

    if (run.status === 'success') {
      return { leadsInDb, completed: true };
    }

    if (run.status === 'failed') {
      return { leadsInDb, completed: false, error: run.error_message ?? 'Sync failed' };
    }

    if (run.status === 'stopped') {
      return { leadsInDb, completed: false, error: run.error_message ?? 'Sync stopped' };
    }

    if (run.status === 'paused' && !data.syncInProgress) {
      return { leadsInDb, completed: false, error: 'Sync paused' };
    }

    if (run.status === 'partial' && !data.syncInProgress) {
      const msg = run.error_message ?? 'Sync paused — click Continue sync';
      return { leadsInDb, completed: false, error: msg };
    }
  }

  return {
    leadsInDb: 0,
    completed: false,
    error: 'Sync is still running in the background. Refresh the page in a few minutes.',
  };
}

export async function syncBatchLeadsUntilComplete(
  onProgress?: (result: InventorySyncResult) => void,
  options?: { force?: boolean; mode?: SyncMode },
): Promise<{ leadsInDb: number; completed: boolean; error?: string }> {
  const { data: status } = await getBatchSyncStatus();
  const shouldResume = status?.canResume && status.lastRun?.status !== 'stopped' && !options?.force;
  const action = shouldResume ? 'resume' : 'sync';

  const { result, error } = action === 'resume'
    ? await resumeBatchLeads(status?.lastRun?.id)
    : await syncBatchLeads({ action: 'sync', force: options?.force ?? !shouldResume, mode: options?.mode ?? 'full' });

  if (error || !result) {
    return { leadsInDb: status?.leadsInDb ?? 0, completed: false, error: error ?? 'Sync failed' };
  }

  onProgress?.(result);

  if (result.completed) {
    return { leadsInDb: result.leadsInDb, completed: true };
  }

  return waitForBatchSyncComplete((s) => {
    if (s.lastRun && s.progress) {
      onProgress?.({
        runId: s.lastRun.id,
        leadsInDb: s.progress.leadsInDb,
        chunkNew: 0,
        chunkUpdated: 0,
        cumulativeNew: s.progress.cumulativeNew,
        cumulativeUpdated: s.progress.cumulativeUpdated,
        pagesProcessed: 0,
        pagesProcessedTotal: s.progress.pagesProcessedTotal,
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
    if (params.statuses && params.statuses.length > 0) query.set('status', params.statuses.join(','));
    if (params.filingTypes && params.filingTypes.length > 0) query.set('filing_type', params.filingTypes.join(','));
    if (params.assignedRep !== undefined && params.assignedRep !== null) {
      query.set('assigned_rep', params.assignedRep);
    }
    if (params.minEquity !== undefined && params.minEquity !== null) {
      query.set('min_equity', String(params.minEquity));
    }
    if (params.maxEquity !== undefined && params.maxEquity !== null) {
      query.set('max_equity', String(params.maxEquity));
    }
    if (params.pipelineOnly) query.set('pipeline', 'true');
    if (params.pipelineStage) query.set('pipeline_stage', params.pipelineStage);
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

  const mode = lastRun.metadata?.mode ?? 'full';
  const leadsInDb = status.leadsInDb;

  if (syncInProgress || lastRun.status === 'running') {
    if (mode === 'incremental') {
      const n = progress?.cumulativeNew ?? 0;
      const u = progress?.cumulativeUpdated ?? 0;
      const pages = progress?.pagesProcessedTotal ?? 0;
      if (n > 0 || u > 0) {
        return `Incremental sync… ${n.toLocaleString()} new, ${u.toLocaleString()} updated (${pages} pages)`;
      }
      return `Incremental sync… scanning for new leads`;
    }
    // Full sync: show DB count vs Batch total (these are comparable in full mode)
    const total = progress?.totalAvailable;
    if (total != null) return `Syncing… ${leadsInDb.toLocaleString()} / ~${total.toLocaleString()}`;
    return `Syncing… ${leadsInDb.toLocaleString()} leads`;
  }

  if (lastRun.status === 'paused') {
    if (mode === 'incremental') {
      const n = progress?.cumulativeNew ?? 0;
      return `Incremental paused — ${n.toLocaleString()} new leads found so far`;
    }
    const total = progress?.totalAvailable;
    if (total != null) return `Paused at ${leadsInDb.toLocaleString()} / ~${total.toLocaleString()} leads`;
    return `Paused at ${leadsInDb.toLocaleString()} leads`;
  }
  if (lastRun.status === 'partial') {
    return `Interrupted — resume to continue`;
  }
  if (lastRun.status === 'stopped') {
    return `Stopped at ${leadsInDb.toLocaleString()} leads in DB`;
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

// ─── Admin Lead Actions ─────────────────────────────────────────────────────

export async function fetchReps(): Promise<{ reps?: InventoryRep[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-leads?action=reps`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to load reps' };
    return { reps: data.reps };
  } catch {
    return { error: 'Network error' };
  }
}

export async function assignRep(
  leadIds: string[],
  repId: string | null,
): Promise<{ updated?: number; error?: string }> {
  if (leadIds.length === 0) return { updated: 0 };
  try {
    const res = await fetch(`${BASE_URL}/admin-leads?action=assign`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ leadIds, repId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to assign' };
    return { updated: data.updated };
  } catch {
    return { error: 'Network error' };
  }
}

const PIPELINE_COLUMN_LIMIT = 100;

export async function fetchAllPipelineLeads(): Promise<{
  leads: InventoryLead[];
  total: number;
  stageCounts: Record<PipelineStage, number>;
  error?: string;
}> {
  const stageCounts = {} as Record<PipelineStage, number>;
  const all: InventoryLead[] = [];

  const pages = await Promise.all(
    PIPELINE_STAGES.map((stage) =>
      fetchInventoryLeads({
        source: 'Batch',
        pipelineOnly: true,
        pipelineStage: stage,
        limit: PIPELINE_COLUMN_LIMIT,
        offset: 0,
      }),
    ),
  );

  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const page = pages[i];
    const stage = PIPELINE_STAGES[i];
    if (page.error) return { leads: [], total: 0, stageCounts, error: page.error };
    stageCounts[stage] = page.total ?? 0;
    all.push(...(page.leads ?? []));
  }

  const total = Object.values(stageCounts).reduce((sum, n) => sum + n, 0);
  return { leads: all, total, stageCounts };
}

export async function setPipelineStage(
  leadIds: string[],
  pipelineStage: PipelineStage,
): Promise<{ updated?: number; error?: string }> {
  if (leadIds.length === 0) return { updated: 0 };
  try {
    const res = await fetch(`${BASE_URL}/admin-leads?action=pipeline_stage`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ leadIds, pipelineStage }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update pipeline stage' };
    return { updated: data.updated };
  } catch {
    return { error: 'Network error' };
  }
}

export async function setLeadStatus(
  leadIds: string[],
  status: InventoryStatus,
): Promise<{ updated?: number; error?: string }> {
  if (leadIds.length === 0) return { updated: 0 };
  try {
    const res = await fetch(`${BASE_URL}/admin-leads?action=status`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ leadIds, status }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update status' };
    return { updated: data.updated };
  } catch {
    return { error: 'Network error' };
  }
}
