import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  InventoryLead,
  InventorySource,
  InventoryStatus,
  InventoryFilingType,
} from '@/data/inventoryLeads';
import { useSavedViews } from '@/hooks/useSavedViews';
import BatchSyncControls from '@/components/ceo/BatchSyncControls';
import SourceProvenance from '@/components/shared/SourceProvenance';
import { sendToMojo } from '@/integrations/mojoDialer';
import {
  assignRep,
  fetchInventoryLeads,
  fetchReps,
  formatLastSync,
  formatSyncProgress,
  getBatchSyncStatus,
  setLeadStatus,
  waitForBatchSyncComplete,
  type InventoryRep,
  type InventoryStats,
  type InventorySyncStatus,
} from '@/services/inventory';
import { CEO_BASE } from '@/config/ceoNav';
import { toast } from 'sonner';
import InventoryLeadDrawer, {
  filingColor,
  formatRelative,
  scoreColor,
  statusColor,
} from '@/components/ceo/InventoryLeadDrawer';
import InventoryColumnPicker, {
  INVENTORY_COLUMNS,
  loadVisibleColumns,
} from '@/components/ceo/InventoryColumnPicker';
import InventoryRepPicker from '@/components/ceo/InventoryRepPicker';
import {
  ArrowRightCircle, ArrowUpToLine, ChevronLeft, ChevronRight, Copy, EyeOff,
  Filter, Flame, Globe, Loader2, Search, Star, UserPlus, X,
} from 'lucide-react';

const STATES = ['All', 'FL', 'TX', 'CA', 'AZ', 'NV', 'GA', 'NC', 'IL', 'NY', 'OH'];
const PAGE_SIZE = 50;
const STATUS_OPTIONS: InventoryStatus[] = ['New', 'Contacted', 'Promoted', 'Dismissed'];
// Lead Inventory only shows leads that match the spec's qualification rule
// (equity ≤ 25% AND filing type in the distressed set). The baseline is
// enforced server-side; these chips let the user narrow further within it.
const FILING_OPTIONS: InventoryFilingType[] = ['NOD', 'NTS', 'LP'];

const COLUMN_WIDTHS: Record<string, string> = {
  select: '28px',
  score: '60px',
  owner: 'minmax(140px, 1.4fr)',
  address: 'minmax(180px, 2fr)',
  phone: 'minmax(120px, 1fr)',
  leadType: '92px',
  source: '76px',
  equity: '64px',
  filing: '72px',
  auction: '80px',
  rep: 'minmax(110px, 1fr)',
  status: '92px',
  dateAdded: '90px',
  apn: 'minmax(110px, 1fr)',
  email: 'minmax(140px, 1fr)',
  ltv: '64px',
  attempts: '64px',
  lastContact: '92px',
  lastOutcome: 'minmax(110px, 1fr)',
  city: 'minmax(100px, 1fr)',
  county: 'minmax(100px, 1fr)',
  language: '52px',
  batchList: 'minmax(110px, 1fr)',
};

const EMPTY_STATS: InventoryStats = {
  sourceTotal: 0,
  newToday: 0,
  avgAttempts: 0,
  hotEquity: 0,
  auctionsLt30: 0,
  hotScore: 0,
  bySource: { Batch: 0, Zillow: 0, Meta: 0, Manual: 0 },
};

export default function LeadInventory() {
  const { views } = useSavedViews();

  const [leads, setLeads] = useState<InventoryLead[]>([]);
  const [stats, setStats] = useState<InventoryStats>(EMPTY_STATS);
  const [page, setPage] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastSyncLabel, setLastSyncLabel] = useState('Never');
  const [batchConnected, setBatchConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<InventorySyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [source, setSource] = useState<InventorySource | 'All'>('Batch');
  const [state, setState] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [esOnly, setEsOnly] = useState(false);
  const [activeStatuses, setActiveStatuses] = useState<Set<InventoryStatus>>(
    new Set(['New', 'Contacted', 'Promoted']),
  );
  // Empty set = "all qualified filings" (server enforces the NOD/NTS/LP baseline).
  // Selecting chips narrows further within the qualified set.
  const [activeFilings, setActiveFilings] = useState<Set<InventoryFilingType>>(
    new Set(['NOD', 'NTS', 'LP']),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => loadVisibleColumns());
  const [reps, setReps] = useState<InventoryRep[]>([]);
  const [drawerLead, setDrawerLead] = useState<InventoryLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const repNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reps) m.set(r.id, r.name);
    return m;
  }, [reps]);

  useEffect(() => {
    fetchReps().then(({ reps }) => setReps(reps ?? []));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [source, state, debouncedSearch, minScore, esOnly, activeStatuses, activeFilings]);

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
        minScore,
        esOnly,
        statuses: [...activeStatuses],
        filingTypes: [...activeFilings],
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
      if (fetchedStats) {
        // Defensive: merge with empty defaults so an older/partial server
        // response can't break the UI by leaving KPI fields undefined.
        setStats({
          ...EMPTY_STATS,
          ...fetchedStats,
          bySource: { ...EMPTY_STATS.bySource, ...(fetchedStats.bySource ?? {}) },
        });
      }
      if (lastSync) {
        setLastSyncLabel(formatLastSync(lastSync.completed_at ?? lastSync.started_at));
      }
    }

    setLoading(false);
  }, [source, state, debouncedSearch, minScore, esOnly, activeStatuses, activeFilings, page]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getBatchSyncStatus();
      if (cancelled || !data?.syncInProgress) return;
      setSyncStatus(data);
      setSyncing(true);
      const { leadsInDb, completed, error } = await waitForBatchSyncComplete((s) => {
        if (!cancelled) setSyncStatus(s);
      });
      if (cancelled) return;
      setSyncing(false);
      if (completed) {
        toast.success(`Batch sync complete — ${leadsInDb.toLocaleString()} leads in inventory`);
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

  const rangeStart = totalMatching === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalMatching);

  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  const toggleSel = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllVisible = () => {
    if (selected.size === leads.length && leads.length > 0) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };

  const toggleStatus = (s: InventoryStatus) =>
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const toggleFiling = (f: InventoryFilingType) =>
    setActiveFilings((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });

  const applyView = (filters: Record<string, unknown>) => {
    if ('state' in filters) setState(filters.state as string);
    if ('language' in filters) setEsOnly(filters.language === 'ES');
    if ('minScore' in filters) setMinScore(filters.minScore as number);
  };

  const syncProgressLabel = formatSyncProgress(syncStatus ?? undefined);

  const goToPage = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next));
    setPage(clamped);
    parentRef.current?.scrollTo({ top: 0 });
  };

  // Bulk actions wired to admin-leads
  const clearSelection = () => setSelected(new Set());

  const bulkPushMojo = () => {
    sendToMojo([...selected]).then((r) =>
      toast.success(`${r.queued} leads queued in Mojo`, { description: 'Mojo will dial in order, top first.' }),
    );
    clearSelection();
  };

  const assignLeads = async (leadIds: string[], repId: string | null) => {
    if (leadIds.length === 0) {
      toast.error('Select at least one lead to assign');
      return false;
    }
    const { updated, error } = await assignRep(leadIds, repId);
    if (error) {
      toast.error(error);
      return false;
    }
    const count = updated ?? leadIds.length;
    if (count === 0) {
      toast.error('No leads were updated. Refresh and try again.');
      return false;
    }
    toast.success(
      repId
        ? `Assigned ${count.toLocaleString()} lead${count === 1 ? '' : 's'} to ${repNameById.get(repId) ?? 'rep'}`
        : `Unassigned ${count.toLocaleString()} lead${count === 1 ? '' : 's'}`,
    );
    if (drawerLead && leadIds.includes(drawerLead.id)) {
      setDrawerLead((prev) => (prev ? { ...prev, assignedRepId: repId } : null));
    }
    const { reps: refreshedReps } = await fetchReps();
    if (refreshedReps) setReps(refreshedReps);
    await loadLeads();
    return true;
  };

  const bulkAssign = async (repId: string | null) => {
    const ok = await assignLeads([...selected], repId);
    if (ok) clearSelection();
  };

  const bulkSetStatus = async (status: InventoryStatus) => {
    const ids = [...selected];
    const { updated, error } = await setLeadStatus(ids, status);
    if (error) { toast.error(error); return; }
    toast.success(`${updated ?? ids.length} leads → ${status}`);
    clearSelection();
    loadLeads();
  };

  const drawerAssignRep = async (lead: InventoryLead, repId: string | null) => {
    await assignLeads([lead.id], repId);
  };
  const drawerStatus = async (lead: InventoryLead, status: InventoryStatus) => {
    const { error } = await setLeadStatus([lead.id], status);
    if (error) { toast.error(error); return; }
    toast.success(`Lead → ${status}`);
    setDrawerOpen(false);
    loadLeads();
  };
  const drawerMojo = (lead: InventoryLead) => {
    sendToMojo([lead.id]).then((r) => toast.success(`${r.queued} lead queued in Mojo`));
    setDrawerOpen(false);
  };

  const openDrawer = (lead: InventoryLead) => {
    setDrawerLead(lead);
    setDrawerOpen(true);
  };

  const copyValue = (value: string | null | undefined, label: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`));
  };

  const empty = !loading && !loadError && totalMatching === 0;

  const orderedVisibleColumns = useMemo(
    () => INVENTORY_COLUMNS.filter((c) => visibleColumns.has(c.id)),
    [visibleColumns],
  );

  const gridTemplate = orderedVisibleColumns
    .map((c) => COLUMN_WIDTHS[c.id] ?? 'minmax(80px, 1fr)')
    .join(' ');

  return (
    <div className="space-y-3">
      <SourceProvenance
        chips={[
          {
            source: 'Batch',
            count: (stats.bySource?.Batch ?? 0).toLocaleString(),
            lastSync: lastSyncLabel,
            status: batchConnected
              ? (syncStatus?.syncInProgress ? 'pending' : (stats.bySource?.Batch ?? 0) > 0 ? 'ok' : 'pending')
              : 'pending',
          },
          { source: 'Zillow', count: '0', lastSync: 'Not connected', status: 'pending' },
          { source: 'Meta', count: '0', lastSync: 'Not connected', status: 'pending' },
        ]}
      />

      {syncProgressLabel && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex flex-wrap items-center justify-between gap-2">
          <span>{syncProgressLabel}</span>
          <BatchSyncControls
            batchConnected={batchConnected}
            syncStatus={syncStatus}
            syncing={syncing}
            onSyncingChange={setSyncing}
            onStatusChange={setSyncStatus}
            onComplete={async () => { setPage(1); await loadLeads(); }}
            showHistoryLink={false}
            compact
          />
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex flex-wrap items-center gap-2">
          <span>{loadError}</span>
          <Link to={`${CEO_BASE}/integrations`} className="font-bold underline">Open Integrations</Link>
        </div>
      )}

      {/* 5 spec KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Counter label="New today" value={(stats.newToday ?? 0).toLocaleString()} accent="primary" />
        <Counter label="Avg contact attempts" value={(stats.avgAttempts ?? 0).toFixed(1)} />
        <Counter label="Active qualified" value={(stats.hotEquity ?? 0).toLocaleString()} accent="accent" />
        <Counter label="Auctions < 30d" value={(stats.auctionsLt30 ?? 0).toLocaleString()} accent="speed" />
        <Counter label="Hot (score ≥ 8)" value={(stats.hotScore ?? 0).toLocaleString()} accent="speed" />
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2 top-2.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search owner, address, county…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-md bg-muted outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Select value={source} onChange={(v) => setSource(v as InventorySource | 'All')} options={['All', 'Batch']} />
          <Select value={state} onChange={setState} options={STATES} />
          <label className="text-[11px] flex items-center gap-1.5 text-foreground">
            Score ≥
            <input
              type="number"
              min={0}
              max={10}
              value={minScore}
              onChange={(e) => setMinScore(+e.target.value)}
              className="w-12 px-1.5 py-1 text-xs border rounded-md bg-muted"
            />
          </label>
          <button
            onClick={() => setEsOnly((v) => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${esOnly ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            <Globe size={11} /> ES only
          </button>
          <InventoryColumnPicker visible={visibleColumns} onChange={setVisibleColumns} />
          {!syncProgressLabel && (
            <BatchSyncControls
              batchConnected={batchConnected}
              syncStatus={syncStatus}
              syncing={syncing || loading}
              onSyncingChange={setSyncing}
              onStatusChange={setSyncStatus}
              onComplete={async () => { setPage(1); await loadLeads(); }}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mr-1">Status</span>
          {STATUS_OPTIONS.map((s) => {
            const on = activeStatuses.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${on ? statusColor(s) : 'bg-muted text-muted-foreground border-transparent'}`}
              >
                {s}
              </button>
            );
          })}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold ml-3 mr-1">Filing</span>
          {FILING_OPTIONS.map((f) => {
            const on = activeFilings.has(f);
            return (
              <button
                key={f}
                onClick={() => toggleFiling(f)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${on ? filingColor(f) : 'bg-muted text-muted-foreground border-transparent'}`}
              >
                {f}
              </button>
            );
          })}
          {views.length > 0 && (
            <>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold ml-3 mr-1">Saved</span>
              {views.map((vw) => (
                <button
                  key={vw.id}
                  onClick={() => applyView(vw.filters)}
                  className="px-2 py-0.5 rounded text-[11px] bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 flex items-center gap-1"
                >
                  <Star size={10} /> {vw.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Funnel banner */}
      <div className="rounded-xl border bg-muted/50 px-3 py-2 text-[11px] text-foreground flex items-center justify-between flex-wrap gap-2">
        <span>
          Showing <strong className="text-foreground">{totalMatching.toLocaleString()}</strong> of{' '}
          <strong>{(stats.sourceTotal ?? 0).toLocaleString()}</strong> qualified{' '}
          {source === 'All' ? 'Batch' : source} leads (equity ≤ 25% · NOD/NTS/LP) after filters
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <Filter size={10} /> {activeStatuses.size}/{STATUS_OPTIONS.length} statuses
          · {activeFilings.size > 0 ? `${activeFilings.size} filing` : 'all qualified filings'}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-20 rounded-xl border-2 border-primary bg-primary text-primary-foreground px-3 py-2 flex flex-wrap items-center gap-2 shadow-md">
          <span className="text-xs font-bold">{selected.size} selected</span>
          <button
            onClick={bulkPushMojo}
            className="px-2.5 py-1 rounded bg-primary-foreground text-primary text-[11px] font-bold flex items-center gap-1"
          >
            <ArrowUpToLine size={11} /> Push to Mojo
          </button>
          <InventoryRepPicker
            onPick={bulkAssign}
            trigger={
              <button
                type="button"
                disabled={selected.size === 0}
                className="px-2.5 py-1 rounded bg-primary-foreground/90 text-primary text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={11} /> Assign rep
              </button>
            }
          />
          <button
            onClick={() => bulkSetStatus('Promoted')}
            className="px-2.5 py-1 rounded bg-accent text-accent-foreground text-[11px] font-bold flex items-center gap-1"
          >
            <ArrowRightCircle size={11} /> Promote
          </button>
          <button
            onClick={() => bulkSetStatus('Dismissed')}
            className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center gap-1"
          >
            <EyeOff size={11} /> Dismiss
          </button>
          <button onClick={clearSelection} className="ml-auto opacity-80 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div ref={parentRef} className="overflow-auto relative" style={{ height: 560 }}>
          <div className="min-w-max w-full">
            <div
              className="sticky top-0 z-20 grid gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted font-bold border-b shadow-sm"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {orderedVisibleColumns.map((c) => {
                if (c.id === 'select') {
                  return (
                    <input
                      key={c.id}
                      type="checkbox"
                      checked={selected.size === leads.length && leads.length > 0}
                      onChange={selectAllVisible}
                      className="cursor-pointer"
                      aria-label="Select all visible"
                    />
                  );
                }
                const align = c.id === 'equity' || c.id === 'auction' || c.id === 'score' || c.id === 'ltv' || c.id === 'attempts'
                  ? 'text-right'
                  : '';
                return <span key={c.id} className={align}>{c.label}</span>;
              })}
            </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-30">
              <Loader2 size={28} className="animate-spin text-primary/50" />
            </div>
          )}
          {empty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No Batch leads match your filters</p>
              <p className="text-xs mt-1">
                {batchConnected
                  ? 'Try Sync Batch or loosen filters (status, score, filing).'
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
            {v.getVirtualItems().map((vi) => {
              const lead = leads[vi.index];
              const isSel = selected.has(lead.id);
              const hot = lead.score >= 8;
              return (
                <div
                  key={lead.id}
                  className={`grid gap-2 px-3 items-center text-xs border-b hover:bg-muted/50 cursor-pointer ${isSel ? 'bg-primary/5' : ''}`}
                  style={{
                    gridTemplateColumns: gridTemplate,
                    position: 'absolute',
                    top: 0, left: 0, width: '100%',
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`,
                  }}
                  onClick={(e) => {
                    // Don't open drawer when clicking interactive children
                    const target = e.target as HTMLElement;
                    if (target.closest('input,button,a')) return;
                    openDrawer(lead);
                  }}
                >
                  {orderedVisibleColumns.map((c) => {
                    switch (c.id) {
                      case 'select':
                        return (
                          <input
                            key={c.id}
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleSel(lead.id)}
                            className="cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        );
                      case 'score':
                        return (
                          <span key={c.id} className="text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${scoreColor(lead.score)}`}>
                              {lead.score}
                            </span>
                          </span>
                        );
                      case 'owner':
                        return (
                          <span key={c.id} className="truncate font-medium text-foreground flex items-center gap-1">
                            {hot && <Flame size={10} className="text-amber-500 shrink-0" />}
                            {lead.owner}
                          </span>
                        );
                      case 'address':
                        return (
                          <span key={c.id} className="truncate text-muted-foreground" title={`${lead.address}, ${lead.city}, ${lead.state}`}>
                            {lead.address}, {lead.city}, {lead.state}
                          </span>
                        );
                      case 'phone':
                        return (
                          <span key={c.id} className="flex items-center gap-1">
                            <span className="font-mono text-foreground truncate">{lead.phone ?? '—'}</span>
                            {lead.phone && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyValue(lead.phone, 'Phone'); }}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                title="Copy phone"
                              >
                                <Copy size={10} />
                              </button>
                            )}
                          </span>
                        );
                      case 'leadType':
                        return (
                          <span key={c.id}>
                            <Chip>{lead.leadType ?? 'Homeowner'}</Chip>
                          </span>
                        );
                      case 'source':
                        return (
                          <span key={c.id} title={`Synced ${lastSyncLabel}`}>
                            <Chip>{lead.source}</Chip>
                          </span>
                        );
                      case 'equity':
                        return (
                          <span
                            key={c.id}
                            className={`text-right font-mono ${lead.equityPct <= 25 ? 'text-emerald-600' : 'text-destructive'}`}
                          >
                            {lead.equityPct}%
                          </span>
                        );
                      case 'filing':
                        return (
                          <span key={c.id}>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${filingColor(lead.filingType)}`}>
                              {lead.filingType ?? '—'}
                            </span>
                          </span>
                        );
                      case 'auction':
                        return (
                          <span
                            key={c.id}
                            className={`text-right font-mono ${lead.daysToAuction < 30 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}
                          >
                            {lead.daysToAuction}d
                          </span>
                        );
                      case 'rep': {
                        const name = lead.assignedRepId ? repNameById.get(lead.assignedRepId) : null;
                        if (!name) {
                          return (
                            <span key={c.id}>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                                Unassigned
                              </span>
                            </span>
                          );
                        }
                        const initial = name.slice(0, 1).toUpperCase();
                        const color = reps.find((r) => r.id === lead.assignedRepId)?.avatar_color ?? '#185FA5';
                        return (
                          <span key={c.id} className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ background: color }}
                            >
                              {initial}
                            </span>
                            <span className="truncate text-foreground">{name}</span>
                          </span>
                        );
                      }
                      case 'status':
                        return (
                          <span key={c.id}>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColor(lead.status)}`}>
                              {lead.status}
                            </span>
                          </span>
                        );
                      case 'dateAdded':
                        return (
                          <span
                            key={c.id}
                            className="text-[10px] text-muted-foreground"
                            title={lead.ingestedAt ? new Date(lead.ingestedAt).toISOString() : ''}
                          >
                            {formatRelative(lead.ingestedAt ?? lead.receivedAt)}
                          </span>
                        );
                      case 'apn':
                        return <span key={c.id} className="font-mono text-[10px] truncate text-foreground">{lead.apn ?? '—'}</span>;
                      case 'email':
                        return <span key={c.id} className="truncate text-muted-foreground">{lead.email ?? '—'}</span>;
                      case 'ltv':
                        return <span key={c.id} className="text-right font-mono text-muted-foreground">{lead.ltvPct != null ? `${lead.ltvPct}%` : '—'}</span>;
                      case 'attempts':
                        return <span key={c.id} className="text-right font-mono text-muted-foreground">{lead.contactAttempts ?? 0}</span>;
                      case 'lastContact':
                        return <span key={c.id} className="text-[10px] text-muted-foreground">{lead.lastContactDate ? formatRelative(lead.lastContactDate) : '—'}</span>;
                      case 'lastOutcome':
                        return <span key={c.id} className="truncate text-muted-foreground">{lead.lastOutcome ?? '—'}</span>;
                      case 'city':
                        return <span key={c.id} className="truncate text-muted-foreground">{lead.city || '—'}</span>;
                      case 'county':
                        return <span key={c.id} className="truncate text-muted-foreground">{lead.county || '—'}</span>;
                      case 'language':
                        return <span key={c.id} className="text-[10px] text-muted-foreground">{lead.language}</span>;
                      case 'batchList':
                        return <span key={c.id} className="truncate text-muted-foreground">{lead.batchListName ?? '—'}</span>;
                      default:
                        return <span key={c.id}>—</span>;
                    }
                  })}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="px-3 py-2.5 text-[11px] text-muted-foreground bg-muted border-t flex flex-wrap items-center justify-between gap-3">
          <span>
            {totalMatching > 0
              ? `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalMatching.toLocaleString()}`
              : 'No leads'}
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
        </div>
      </div>

      <InventoryLeadDrawer
        lead={drawerLead}
        open={drawerOpen}
        onOpenChange={(o) => { setDrawerOpen(o); if (!o) setDrawerLead(null); }}
        repNameById={repNameById}
        onAssignRep={drawerAssignRep}
        onStatusChange={drawerStatus}
        onPushToMojo={drawerMojo}
      />
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
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2 py-1.5 text-xs border rounded-md bg-muted outline-none">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border border-muted-foreground/20">
      {children}
    </span>
  );
}
