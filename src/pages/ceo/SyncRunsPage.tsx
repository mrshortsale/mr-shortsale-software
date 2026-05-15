import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import BatchSyncControls from '@/components/ceo/BatchSyncControls';
import { CEO_BASE } from '@/config/ceoNav';
import {
  formatLastSync,
  getBatchSyncStatus,
  listInventorySyncRuns,
  syncStatusLabel,
  syncStatusTone,
  type InventorySyncRun,
  type InventorySyncStatus,
} from '@/services/inventory';

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

function formatProgress(run: InventorySyncRun): string {
  const meta = run.metadata;
  const total = meta?.totalAvailable;
  const page = meta?.lastPage;
  if (total != null && page != null) {
    return `Page ${page} · ${run.leads_upserted.toLocaleString()} / ~${total.toLocaleString()} leads`;
  }
  return `${run.leads_upserted.toLocaleString()} leads saved`;
}

export default function SyncRunsPage() {
  const [runs, setRuns] = useState<InventorySyncRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * PAGE_SIZE;
    const [{ runs: fetched, total: count, error: listErr }, { data: status }] = await Promise.all([
      listInventorySyncRuns({ limit: PAGE_SIZE, offset }),
      getBatchSyncStatus(),
    ]);
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

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Batch Leads import history. Each run pages through saved addresses and upserts into inventory (no duplicates).
          </p>
          {syncStatus && (
            <p className="text-xs text-muted-foreground mt-1">
              {syncStatus.batchLeadCount.toLocaleString()} leads in database
              {!syncStatus.batchConnected && (
                <>
                  {' · '}
                  <Link to={`${CEO_BASE}/integrations`} className="text-primary font-bold underline">
                    Connect Batch Leads
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
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1.2fr_88px_1fr_1fr_1.2fr] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
          <span>Started</span>
          <span>Status</span>
          <span>Leads</span>
          <span>Finished</span>
          <span>Details</span>
        </div>

        {loading && runs.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading sync runs…
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-xs text-destructive">{error}</div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No sync runs yet. Start one from{' '}
            <Link to={`${CEO_BASE}/inventory`} className="text-primary font-bold underline">
              Lead Inventory
            </Link>
            .
          </div>
        )}

        {runs.map((run) => (
          <div
            key={run.id}
            className="grid grid-cols-[1.2fr_88px_1fr_1fr_1.2fr] gap-2 px-3 py-2.5 text-xs border-b last:border-b-0 items-center hover:bg-muted/40"
          >
            <span className="font-mono text-[11px]">
              {new Date(run.started_at).toLocaleString()}
            </span>
            <StatusBadge status={run.status} />
            <span className="font-bold tabular-nums">{run.leads_upserted.toLocaleString()}</span>
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
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
    </div>
  );
}
