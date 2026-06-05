import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import BatchSyncControls from '@/components/ceo/BatchSyncControls';
import MlsSyncControls from '@/components/ceo/MlsSyncControls';
import { CEO_BASE } from '@/config/ceoNav';
import { ADMIN_BASE } from '@/config/adminNav';
import {
  formatLastSync,
  getBatchSyncStatus,
  listInventorySyncRuns,
  syncStatusLabel,
  syncStatusTone,
  type InventorySyncRun,
  type InventorySyncStatus,
} from '@/services/inventory';
import {
  getMlsSyncStatus,
  listMlsSyncRuns,
  type MlsSyncStatus,
  type MlsSyncRun,
} from '@/services/bridgeMls';

const PAGE_SIZE = 15;

function StatusBadge({ status }: { status: string }) {
  const tone = syncStatusTone(status);
  const cls =
    tone === 'ok'
      ? 'bg-speed/15 text-speed border-speed/30'
      : tone === 'pending'
        ? 'bg-primary/10 text-primary border-primary/30'
        : tone === 'error'
          ? 'bg-destructive/10 text-destructive border-destructive/30'
          : 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {syncStatusLabel(status)}
    </span>
  );
}

/**
 * New leads inserted by this run. `cumulativeNew` is tracked for both incremental
 * and full syncs (inserts only — updates go to `cumulativeUpdated`). Older runs
 * that predate this counter fall back to 0.
 */
function runNewLeads(run: InventorySyncRun): number {
  return run.metadata?.cumulativeNew ?? 0;
}

function formatProgress(run: InventorySyncRun): string {
  const meta = run.metadata;
  const mode = meta?.mode ?? 'full';
  const n = meta?.cumulativeNew ?? 0;
  const u = meta?.cumulativeUpdated ?? 0;
  const page = meta?.lastPage;

  if (mode === 'incremental') {
    const pages = meta?.pagesProcessedTotal ?? page;
    const parts: string[] = [];
    if (pages != null) parts.push(`Page ${pages}`);
    parts.push(`+${n.toLocaleString()} new`);
    if (u > 0) parts.push(`${u.toLocaleString()} updated`);
    return parts.join(' · ');
  }

  // Full sync
  const total = meta?.totalAvailable;
  const parts: string[] = [];
  if (page != null) parts.push(`Page ${page}`);
  if (n > 0 || u > 0) {
    let counts = `+${n.toLocaleString()} new`;
    if (u > 0) counts += ` · ${u.toLocaleString()} updated`;
    parts.push(counts);
  }
  if (total != null) parts.push(`~${total.toLocaleString()} in Batch`);
  if (parts.length === 0) return `${run.leads_upserted.toLocaleString()} leads in DB`;
  return parts.join(' · ');
}

export default function SyncRunsPage() {
  const [runs, setRuns] = useState<InventorySyncRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mlsStatus, setMlsStatus] = useState<MlsSyncStatus | null>(null);
  const [mlsRuns, setMlsRuns] = useState<MlsSyncRun[]>([]);
  const [mlsRunsTotal, setMlsRunsTotal] = useState(0);
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * PAGE_SIZE;
    const [{ runs: fetched, total: count, error: listErr }, { data: status }, mlsStatusData, mlsRunsData] = await Promise.all([
      listInventorySyncRuns({ limit: PAGE_SIZE, offset }),
      getBatchSyncStatus(),
      getMlsSyncStatus(),
      listMlsSyncRuns({ limit: PAGE_SIZE, offset: 0 }),
    ]);
    if (mlsStatusData.data) setMlsStatus(mlsStatusData.data);
    setMlsRuns(mlsRunsData.runs);
    setMlsRunsTotal(mlsRunsData.total);
    if (listErr) {
      setError(listErr);
      setRuns([]);
      setTotal(0);
    } else {
      setRuns(fetched ?? []);
      setTotal(count ?? 0);
    }
    if (status) setSyncStatus(status);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!syncStatus?.syncInProgress) return;
    const t = setInterval(() => {
      getBatchSyncStatus().then(({ data }) => {
        if (data) setSyncStatus(data);
      });
      loadRuns();
    }, 3000);
    return () => clearInterval(t);
  }, [syncStatus?.syncInProgress, loadRuns]);

  // Poll MLS status while any profile is syncing
  const mlsAnyRunning = mlsStatus?.profiles.some((p) => p.syncInProgress) ?? false;
  useEffect(() => {
    if (!mlsAnyRunning) return;
    const timer = setInterval(() => {
      getMlsSyncStatus().then(({ data }) => { if (data) setMlsStatus(data); });
      listMlsSyncRuns({ limit: PAGE_SIZE, offset: 0 }).then(({ runs: r, total: tot }) => {
        setMlsRuns(r); setMlsRunsTotal(tot);
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [mlsAnyRunning]);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {t('syncRuns.description')}
          </p>
          {syncStatus && (
            <p className="text-xs text-muted-foreground mt-1">
              {syncStatus.leadsInDb.toLocaleString(loc)} {t('syncRuns.leadsInDatabase')}
              {!syncStatus.batchConnected && (
                <>
                  {' · '}
                  <Link to={`${ADMIN_BASE}/integrations`} className="text-primary font-bold underline">
                    {t('syncRuns.connectBatchLeads')}
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BatchSyncControls
            batchConnected={syncStatus?.batchConnected ?? false}
            syncStatus={syncStatus}
            syncing={syncing}
            onSyncingChange={setSyncing}
            onStatusChange={setSyncStatus}
            onComplete={loadRuns}
            showHistoryLink={false}
          />
          <button
            type="button"
            onClick={loadRuns}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-md bg-muted text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t('syncRuns.syncNow')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1.2fr_88px_1fr_1fr_1.2fr] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
          <span>{t('syncRuns.table.started')}</span>
          <span>{t('syncRuns.table.status')}</span>
          <span>{t('syncRuns.table.result')}</span>
          <span>{t('syncRuns.table.duration')}</span>
          <span>{t('syncRuns.table.result')}</span>
        </div>

        {loading && runs.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> {t('common.loading')}
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-xs text-destructive">{error}</div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t('syncRuns.empty')}{' '}
            <Link to={`${CEO_BASE}/inventory`} className="text-primary font-bold underline">
              {t('nav.inventory')}
            </Link>
          </div>
        )}

        {runs.map((run) => (
          <div
            key={run.id}
            className="grid grid-cols-[1.2fr_88px_1fr_1fr_1.2fr] gap-2 px-3 py-2.5 text-xs border-b last:border-b-0 items-center hover:bg-muted/40"
          >
            <span className="font-mono text-[11px]">
              {new Date(run.started_at).toLocaleString(loc)}
            </span>
            <StatusBadge status={run.status} />
            <span className="font-bold tabular-nums">
              {run.metadata?.mode === 'incremental'
                ? `+${runNewLeads(run).toLocaleString()}`
                : runNewLeads(run).toLocaleString()}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {run.completed_at ? formatLastSync(run.completed_at) : '—'}
            </span>
            <span className="text-[11px] text-muted-foreground truncate" title={run.error_message ?? undefined}>
              {run.error_message ?? formatProgress(run)}
            </span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('syncRuns.pagination', {
              start: (page - 1) * PAGE_SIZE + 1,
              end: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── MLS / Bridge sync section ───────────────────────────────────── */}
      <div className="border-t pt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">MLS / Realtor Sync</p>
            <p className="text-xs text-muted-foreground">
              {mlsStatus
                ? `${mlsStatus.profiles.filter((p) => p.enabled).length} enabled feed(s) · ${mlsStatus.profiles.reduce((n, p) => n + p.agentsInDb, 0).toLocaleString(loc)} agents in DB`
                : 'Loading…'}
            </p>
          </div>
          {mlsStatus && (
            <MlsSyncControls
              status={mlsStatus}
              onStatusChange={setMlsStatus}
            />
          )}
        </div>

        {mlsRuns.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-[1.2fr_88px_1fr_1.5fr_1.2fr] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
              <span>Started</span>
              <span>Status</span>
              <span>Agents</span>
              <span>Feed</span>
              <span>Progress</span>
            </div>
            {mlsRuns.map((run) => {
              const meta = run.metadata ?? {};
              const agentCount = run.leads_upserted;
              const feedLabel = run.dataset_id;
              const progress = [
                meta.pagesProcessedTotal ? `Page ${meta.pagesProcessedTotal}` : null,
                meta.cumulativeNew ? `+${Number(meta.cumulativeNew).toLocaleString(loc)} new` : null,
                meta.cumulativeUpdated ? `${Number(meta.cumulativeUpdated).toLocaleString(loc)} updated` : null,
              ].filter(Boolean).join(' · ');
              return (
                <div
                  key={run.id}
                  className="grid grid-cols-[1.2fr_88px_1fr_1.5fr_1.2fr] gap-2 px-3 py-2.5 text-xs border-b last:border-b-0 items-center hover:bg-muted/40"
                >
                  <span className="font-mono text-[11px]">{new Date(run.started_at).toLocaleString(loc)}</span>
                  <StatusBadge status={run.status} />
                  <span className="font-bold tabular-nums">{agentCount.toLocaleString(loc)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{feedLabel}</span>
                  <span className="text-[11px] text-muted-foreground truncate" title={run.error_message ?? undefined}>
                    {run.error_message ?? progress ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {mlsRuns.length === 0 && mlsStatus && (
          <p className="text-xs text-muted-foreground">
            No MLS sync runs yet.{' '}
            {mlsStatus.profiles.filter((p) => p.enabled).length === 0
              ? 'Enable a feed in Integrations → Zillow Listings → MLS Feeds.'
              : 'Click "Full sync" to start.'}
          </p>
        )}

        {mlsRunsTotal > PAGE_SIZE && (
          <p className="text-xs text-muted-foreground">Showing {mlsRuns.length} of {mlsRunsTotal.toLocaleString(loc)} MLS runs.</p>
        )}
      </div>
    </div>
  );
}
