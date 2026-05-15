import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { InventoryLead, InventorySource } from '@/data/inventoryLeads';
import { useSavedViews } from '@/hooks/useSavedViews';
import SourceProvenance from '@/components/shared/SourceProvenance';
import { sendToMojo } from '@/integrations/mojoDialer';
import {
  fetchInventoryLeads,
  formatLastSync,
  formatSyncProgress,
  getBatchSyncStatus,
  resumeBatchLeads,
  syncBatchLeadsUntilComplete,
  waitForBatchSyncComplete,
  type InventoryStats,
  type InventorySyncStatus,
} from '@/services/inventory';
import { CEO_BASE } from '@/config/ceoNav';
import { toast } from 'sonner';
import {
  Search, Star, ArrowUpToLine, UserPlus, ArrowRightCircle, EyeOff,
  Flame, Filter, X, Globe, RefreshCw, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

const STATES = ['All', 'FL', 'TX', 'CA', 'AZ', 'NV', 'GA', 'NC', 'IL', 'NY', 'OH'];
const PAGE_SIZE = 50;

export default function LeadInventory() {
  const { views } = useSavedViews();

  const [leads, setLeads] = useState<InventoryLead[]>([]);
  const [stats, setStats] = useState<InventoryStats>({
    total: 0, hot: 0, triage: 0, bySource: { Batch: 0, Zillow: 0, Meta: 0, Manual: 0 },
  });
  const [page, setPage] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSyncLabel, setLastSyncLabel] = useState('Never');
  const [batchConnected, setBatchConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [source, setSource] = useState<InventorySource | 'All'>('All');
  const [state, setState] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minScore, setMinScore] = useState(7);
  const [esOnly, setEsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [source, state, debouncedSearch, minScore, esOnly, showAll]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const offset = (page - 1) * PAGE_SIZE;

    const [{ data: status }, fetchResult] = await Promise.all([
      getBatchSyncStatus(),
      fetchInventoryLeads({
        source: source === 'All' ? 'Batch' : source,
        state,
        q: debouncedSearch || undefined,
        minScore: showAll ? 0 : minScore,
        esOnly,
        triageOnly: !showAll,
        limit: PAGE_SIZE,
        offset,
      }),
    ]);

    if (status) {
      setBatchConnected(status.batchConnected);
      setSyncStatus(status);
      const syncTime = status.lastRun?.completed_at ?? status.lastRun?.started_at;
      setLastSyncLabel(formatLastSync(syncTime));
    }

    const { leads: fetched, total, totalPages: pages, stats: fetchedStats, lastSync, error } = fetchResult;

    if (error) {
      setLoadError(error);
      setLeads([]);
      setTotalMatching(0);
      setTotalPages(1);
    } else {
      setLeads(fetched ?? []);
      setTotalMatching(total ?? 0);
      setTotalPages(Math.max(1, pages ?? 1));
      if (fetchedStats) setStats(fetchedStats);
      if (lastSync) {
        setLastSyncLabel(formatLastSync(lastSync.completed_at ?? lastSync.started_at));
      }
    }

    setLoading(false);
  }, [source, state, debouncedSearch, minScore, esOnly, showAll, page]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // If a background sync was already running (e.g. tab reopened), poll until it finishes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await getBatchSyncStatus();
      if (cancelled || !data?.syncInProgress) return;

      setSyncStatus(data);
      setSyncing(true);
      const { totalUpserted, completed, error } = await waitForBatchSyncComplete((s) => {
        if (!cancelled) setSyncStatus(s);
      });
      if (cancelled) return;
      setSyncing(false);
      if (completed) {
        toast.success(`Batch sync complete — ${totalUpserted.toLocaleString()} leads in inventory`);
        setPage(1);
        await loadLeads();
      } else if (error) {
        toast.message(error, { duration: 6000 });
        await loadLeads();
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (hidden.has(l.id)) return false;
      if (source !== 'All' && l.source !== source) return false;
      return true;
    });
  }, [leads, hidden, source]);

  const counts = useMemo(() => ({
    total: stats.total,
    Batch: stats.bySource.Batch,
    Zillow: stats.bySource.Zillow,
    Meta: stats.bySource.Meta,
    Manual: stats.bySource.Manual,
    hot: stats.hot,
    triage: stats.triage,
  }), [stats]);

  const rangeStart = totalMatching === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalMatching);

  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  const toggleSel = (id: string) =>
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllVisible = () => {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  const applyView = (filters: Record<string, unknown>) => {
    if ('state' in filters) setState(filters.state as string);
    if ('language' in filters) setEsOnly(filters.language === 'ES');
    if ('minScore' in filters) setMinScore(filters.minScore as number);
    if ('maxAuction' in filters) { setMinScore(0); setShowAll(true); }
  };

  const handleSync = async () => {
    if (!batchConnected) {
      toast.error('Connect Batch Leads under Integrations first');
      return;
    }

    setSyncing(true);
    try {
      const { totalUpserted, completed, error } = await syncBatchLeadsUntilComplete((progress) => {
        toast.message(`Syncing Batch Leads… ${progress.leadsUpserted.toLocaleString()} leads`, {
          id: 'batch-sync',
          duration: 2000,
        });
      });
      toast.dismiss('batch-sync');
      if (error) {
        toast.message(error, { duration: 6000 });
      } else if (completed) {
        toast.success(`Synced ${totalUpserted.toLocaleString()} Batch leads`);
        setPage(1);
      }
      await loadLeads();
    } finally {
      setSyncing(false);
    }
  };

  const handleResume = async () => {
    if (!batchConnected) {
      toast.error('Connect Batch Leads under Integrations first');
      return;
    }
    setSyncing(true);
    try {
      const { result, error } = await resumeBatchLeads();
      if (error) {
        toast.error(error);
        return;
      }
      if (result?.backgroundContinuing) {
        toast.message('Resuming sync in the background…', { id: 'batch-sync' });
      }
      const { totalUpserted, completed, error: waitErr } = await waitForBatchSyncComplete((s) => {
        setSyncStatus(s);
        const label = formatSyncProgress(s);
        if (label) {
          toast.message(label, { id: 'batch-sync', duration: 2000 });
        }
      });
      toast.dismiss('batch-sync');
      if (waitErr) toast.message(waitErr, { duration: 6000 });
      else if (completed) toast.success(`Sync complete — ${totalUpserted.toLocaleString()} leads`);
      setPage(1);
      await loadLeads();
    } finally {
      setSyncing(false);
    }
  };

  const syncProgressLabel = formatSyncProgress(syncStatus ?? undefined);
  const canResume = syncStatus?.canResume && !syncStatus.syncInProgress;

  const goToPage = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next));
    setPage(clamped);
    parentRef.current?.scrollTo({ top: 0 });
  };

  const bulkPushMojo = () => {
    sendToMojo([...selected]).then(r =>
      toast.success(`${r.queued} leads queued in Mojo`, { description: 'Mojo will dial in order, top first.' })
    );
    setSelected(new Set());
  };
  const bulkPromote = () => {
    toast.success(`${selected.size} leads promoted to Active Pipeline`);
    setHidden(p => new Set([...p, ...selected]));
    setSelected(new Set());
  };
  const bulkAssign = () => toast(`Assign ${selected.size} leads — pick a rep…`);
  const bulkDismiss = () => {
    setHidden(p => new Set([...p, ...selected]));
    toast(`${selected.size} leads moved to Dismissed`);
    setSelected(new Set());
  };

  const empty = !loading && !loadError && totalMatching === 0;

  return (
    <div className="space-y-3">
      <SourceProvenance
        chips={[
          {
            source: 'Batch',
            count: counts.Batch.toLocaleString(),
            lastSync: lastSyncLabel,
            status: batchConnected
              ? (syncStatus?.syncInProgress ? 'pending' : counts.Batch > 0 ? 'ok' : 'pending')
              : 'pending',
          },
          { source: 'Zillow', count: '0', lastSync: 'Not connected', status: 'pending' },
          { source: 'Meta', count: '0', lastSync: 'Not connected', status: 'pending' },
        ]}
      />

      {syncProgressLabel && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex flex-wrap items-center justify-between gap-2">
          <span>{syncProgressLabel}</span>
          {canResume && (
            <button
              type="button"
              onClick={handleResume}
              disabled={syncing}
              className="font-bold text-primary underline disabled:opacity-60"
            >
              Continue sync
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex flex-wrap items-center gap-2">
          <span>{loadError}</span>
          <Link to={`${CEO_BASE}/integrations`} className="font-bold underline">Open Integrations</Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Counter label="Total inventory" value={counts.total.toLocaleString()} />
        <Counter label="Triage queue" value={counts.triage.toLocaleString()} accent="primary" />
        <Counter label="Hot (score ≥8)" value={counts.hot.toLocaleString()} accent="speed" />
        <Counter label="Selected" value={selected.size.toLocaleString()} accent="accent" />
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2 top-2.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search owner, address, county…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-md bg-muted outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Select value={source} onChange={v => setSource(v as InventorySource | 'All')} options={['All', 'Batch', 'Zillow', 'Meta', 'Manual']} />
          <Select value={state} onChange={setState} options={STATES} />
          <label className="text-[11px] flex items-center gap-1.5 text-foreground">
            Score ≥
            <input type="number" min={0} max={10} value={minScore} onChange={e => setMinScore(+e.target.value)} className="w-12 px-1.5 py-1 text-xs border rounded-md bg-muted" />
          </label>
          <button
            onClick={() => setEsOnly(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${esOnly ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            <Globe size={11} /> ES only
          </button>
          <button
            onClick={() => setShowAll(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${showAll ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}
            title={showAll ? `Showing all ${counts.total.toLocaleString()}` : 'Showing triage queue only'}
          >
            <Filter size={11} /> {showAll ? `All ${counts.total.toLocaleString()}` : 'Triage only'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1 disabled:opacity-60"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Syncing…' : 'Sync Batch'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Saved views</span>
          {views.map(v => (
            <button key={v.id} onClick={() => applyView(v.filters)} className="px-2 py-0.5 rounded text-[11px] bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 flex items-center gap-1">
              <Star size={10} /> {v.name}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-20 rounded-xl border-2 border-primary bg-primary text-primary-foreground px-3 py-2 flex flex-wrap items-center gap-2 shadow-md">
          <span className="text-xs font-bold">{selected.size} selected</span>
          <button onClick={bulkPushMojo} className="px-2.5 py-1 rounded bg-primary-foreground text-primary text-[11px] font-bold flex items-center gap-1"><ArrowUpToLine size={11} /> Push to Mojo</button>
          <button onClick={bulkAssign} className="px-2.5 py-1 rounded bg-primary-foreground/90 text-primary text-[11px] font-bold flex items-center gap-1"><UserPlus size={11} /> Assign rep</button>
          <button onClick={bulkPromote} className="px-2.5 py-1 rounded bg-accent text-accent-foreground text-[11px] font-bold flex items-center gap-1"><ArrowRightCircle size={11} /> Promote to Pipeline</button>
          <button onClick={bulkDismiss} className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center gap-1"><EyeOff size={11} /> Dismiss</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto opacity-80 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[28px_1.6fr_2fr_56px_72px_64px_44px_44px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b">
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAllVisible} className="cursor-pointer" />
          <span>Owner</span>
          <span>Address</span>
          <span className="text-right">Eq%</span>
          <span className="text-right">Auction</span>
          <span className="text-right">Score</span>
          <span>Lang</span>
          <span>Src</span>
        </div>
        <div ref={parentRef} className="overflow-auto relative" style={{ height: 560 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
              <Loader2 size={28} className="animate-spin text-primary/50" />
            </div>
          )}
          {empty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No Batch leads match your filters</p>
              <p className="text-xs mt-1">
                {batchConnected
                  ? 'Try Sync Batch or loosen filters (state, score, triage).'
                  : 'Connect Batch Leads under Integrations, then sync here.'}
              </p>
              {!batchConnected && (
                <Link to={`${CEO_BASE}/integrations`} className="mt-2 text-primary font-bold text-xs hover:underline">
                  Go to Integrations
                </Link>
              )}
            </div>
          )}
          <div style={{ height: v.getTotalSize(), position: 'relative' }}>
            {v.getVirtualItems().map(vi => {
              const lead = filtered[vi.index];
              const isSel = selected.has(lead.id);
              const hot = lead.score >= 8;
              return (
                <div
                  key={lead.id}
                  className={`grid grid-cols-[28px_1.6fr_2fr_56px_72px_64px_44px_44px] gap-2 px-3 items-center text-xs border-b hover:bg-muted/50 ${isSel ? 'bg-primary/5' : ''}`}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: vi.size, transform: `translateY(${vi.start}px)` }}
                >
                  <input type="checkbox" checked={isSel} onChange={() => toggleSel(lead.id)} className="cursor-pointer" />
                  <span className="truncate font-medium text-foreground flex items-center gap-1">
                    {hot && <Flame size={10} className="text-speed shrink-0" />}
                    {lead.owner}
                  </span>
                  <span className="truncate text-muted-foreground">{lead.address}, {lead.city}, {lead.state}</span>
                  <span className={`text-right font-mono ${lead.equityPct <= 15 ? 'text-destructive' : 'text-foreground'}`}>{lead.equityPct}</span>
                  <span className={`text-right font-mono ${lead.daysToAuction <= 30 ? 'text-speed font-bold' : 'text-muted-foreground'}`}>{lead.daysToAuction}d</span>
                  <span className="text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${lead.score >= 8 ? 'bg-speed text-white' : lead.score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {lead.score}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">{lead.language}</span>
                  <span className="text-[10px] text-muted-foreground">{lead.source}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-3 py-2.5 text-[11px] text-muted-foreground bg-muted border-t flex flex-wrap items-center justify-between gap-3">
          <span>
            {totalMatching > 0
              ? `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalMatching.toLocaleString()}`
              : 'No leads'}
            {hidden.size > 0 && ` · ${hidden.size} hidden on this page`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 rounded border bg-card hover:bg-background disabled:opacity-40 flex items-center gap-0.5 font-bold text-foreground"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-2 py-1 font-medium text-foreground tabular-nums">
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 rounded border bg-card hover:bg-background disabled:opacity-40 flex items-center gap-0.5 font-bold text-foreground"
              aria-label="Next page"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>

          {hidden.size > 0 && (
            <button onClick={() => setHidden(new Set())} className="text-primary font-bold hover:underline shrink-0">
              Restore {hidden.size} dismissed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, accent }: { label: string; value: string; accent?: 'primary' | 'speed' | 'accent' }) {
  const border =
    accent === 'speed' ? 'border-l-speed' :
    accent === 'accent' ? 'border-l-accent' :
    accent === 'primary' ? 'border-l-primary' : 'border-l-muted-foreground/30';
  return (
    <div className={`metric-card border-l-4 ${border}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="px-2 py-1.5 text-xs border rounded-md bg-muted outline-none">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
