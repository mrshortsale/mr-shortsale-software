import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RealtorLeadStatus,
  relativeTime,
} from '@/data/realtorLeads';
import {
  fetchRealtorLeads,
  fetchRealtorReps,
  updateRealtorLeadStatus,
  assignRealtorRep,
  roundRobinAssignRealtorLeads,
  isHotAgent,
  type RealtorAgent,
  type RealtorStats,
} from '@/services/realtor';
import {
  Filter, ArrowUpDown, Calendar, MapPin, Phone,
  TrendingDown, Flame, Building2, Globe, Users, RefreshCw, ArrowUpToLine, Loader2, Send,
  Mail, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { sendToMojo } from '@/integrations/mojoDialer';
import { toast } from 'sonner';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';
import SourceProvenance from '@/components/shared/SourceProvenance';

type SortKey = 'days' | 'price' | 'drops' | 'newest';

const statusBadge: Record<RealtorLeadStatus, string> = {
  'New':         'bg-secondary/15 text-secondary',
  'Contacted':   'bg-amber-100 text-amber-700',
  'Partnered':   'bg-accent/15 text-accent',
  'Closed Won':  'bg-accent text-accent-foreground',
  'Declined':    'bg-muted text-muted-foreground',
};

function realtorStatusKey(status: RealtorLeadStatus): string {
  const map: Record<RealtorLeadStatus, string> = {
    'New': 'realtorQueue.status.new',
    'Contacted': 'realtorQueue.status.contacted',
    'Partnered': 'realtorQueue.status.partnered',
    'Closed Won': 'realtorQueue.status.closedWon',
    'Declined': 'realtorQueue.status.declined',
  };
  return map[status];
}

export default function RealtorLeadQueue() {
  const [agents, setAgents] = useState<RealtorAgent[]>([]);
  const [stats, setStats] = useState<RealtorStats>({ total: 0, newToday: 0, hotLeads: 0, awaitingFollowup: 0, lastSyncAt: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawerAgent, setDrawerAgent] = useState<RealtorAgent | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | RealtorLeadStatus>('all');
  const [filterRep, setFilterRep] = useState<string>('all');
  const [repNames, setRepNames] = useState<string[]>([]);
  const [roundRobinAssigning, setRoundRobinAssigning] = useState(false);
  const [esOnly, setEsOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [totalMatching, setTotalMatching] = useState(0);
  const pageSize = 50;
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [bulkRep, setBulkRep] = useState('');
  const [mojoPushing, setMojoPushing] = useState<Set<string>>(new Set());
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const repOptions = useMemo(() => ['Unassigned', ...repNames], [repNames]);

  useEffect(() => {
    fetchRealtorReps().then(({ reps }) => {
      const names = reps.map(r => r.name).filter(Boolean);
      setRepNames(names);
      if (names.length > 0) setBulkRep(prev => prev || names[0]);
    });
  }, []);

  const load = useCallback(async () => {
    const offset = (page - 1) * pageSize;
    setLoading(true);
    const { leads, stats: s, error, total } = await fetchRealtorLeads({
      statuses: filterStatus === 'all' ? undefined : [filterStatus],
      state: filterState === 'all' ? undefined : filterState,
      language: esOnly ? 'ES' : undefined,
      hotOnly,
      assignedRep: filterRep === 'all' ? undefined : filterRep === 'unassigned' ? 'unassigned' : filterRep,
      limit: pageSize,
      offset,
    });
    setLoading(false);

    if (error) {
      setLoadError(error);
      setAgents([]);
      setTotalMatching(0);
      setStats({ total: 0, newToday: 0, hotLeads: 0, awaitingFollowup: 0, lastSyncAt: null });
      return;
    }

    setLoadError(null);
    setAgents(leads);
    setStats(s);
    setTotalMatching(total ?? 0);
  }, [filterStatus, filterState, filterRep, esOnly, hotOnly, page]);

  const handleRoundRobinAssign = async () => {
    setRoundRobinAssigning(true);
    const { assigned, repCount, error } = await roundRobinAssignRealtorLeads();
    setRoundRobinAssigning(false);
    if (error) {
      toast.error(`Round-robin failed: ${error}`);
      return;
    }
    if (assigned === 0) {
      toast.info(repCount === 0 ? 'No active sales reps found' : 'No unassigned or orphaned leads to distribute');
      return;
    }
    toast.success(`Assigned ${assigned} lead${assigned !== 1 ? 's' : ''} across ${repCount} rep${repCount !== 1 ? 's' : ''}`);
    load();
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPageInput(String(page)); }, [page]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
  const offset = (page - 1) * pageSize;
  const rangeStart = totalMatching === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + agents.length, totalMatching);

  const goToPage = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next));
    setPage(clamped);
    setPageInput(String(clamped));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyPageInput = () => {
    const n = parseInt(pageInput.trim(), 10);
    if (!Number.isFinite(n)) {
      setPageInput(String(page));
      return;
    }
    goToPage(n);
  };

  const list = useMemo(() => {
    let l = [...agents];
    l.sort((a, b) => {
      if (sortKey === 'days') return b.latestDaysOnMarket - a.latestDaysOnMarket;
      if (sortKey === 'price') return b.latestListPrice - a.latestListPrice;
      if (sortKey === 'drops') return b.listingCount - a.listingCount;
      return a.latestDaysOnMarket - b.latestDaysOnMarket;
    });
    return l;
  }, [agents, sortKey]);

  const toggleBulk = (id: string) => {
    setBulk(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyBulk = () => {
    const targets = list.filter(a => bulk.has(a.id));
    targets.forEach(agent => handleAssignRep(agent, bulkRep));
    setBulk(new Set());
  };

  const pushToMojo = async (targets: RealtorAgent[]) => {
    const ids = new Set(targets.map(a => a.id));
    setMojoPushing(prev => new Set([...prev, ...ids]));
    try {
      const result = await sendToMojo(targets);
      if (result.ok) {
        toast.success(`Sent ${result.sent} agent${result.sent !== 1 ? 's' : ''} to Mojo`);
      } else if (result.sent > 0) {
        toast.warning(`Sent ${result.sent}, failed ${result.failed}: ${result.errors[0] ?? ''}`);
      } else {
        toast.error(`Push failed: ${result.errors[0] ?? 'Unknown error'}`);
      }
    } catch (e) {
      toast.error(`Push failed: ${(e as Error).message}`);
    } finally {
      setMojoPushing(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
    }
  };

  const handleStatusChange = async (agent: RealtorAgent, status: RealtorLeadStatus) => {
    const { error } = await updateRealtorLeadStatus(agent.id, status);
    if (error) { toast.error(error); return; }
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status } : a));
    toast.success('Status updated');
  };

  const handleAssignRep = async (agent: RealtorAgent, rep: string) => {
    const repValue = rep === 'Unassigned' ? null : rep;
    // Optimistic update
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, assignedRep: repValue } : a));
    const { error } = await assignRealtorRep(agent.id, repValue);
    if (error) {
      toast.error(`Failed to assign rep: ${error}`);
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, assignedRep: agent.assignedRep } : a));
    }
  };

  const lastSyncLabel = stats.lastSyncAt
    ? new Date(stats.lastSyncAt).toLocaleString(loc)
    : 'Never';

  return (
    <div className="space-y-4">
      {/* Header strip — stats + freshness */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Building2 size={14} />} label={t('realtorQueue.stats.total')} value={stats.total} />
        <Stat icon={<Flame size={14} />}     label={t('realtorQueue.stats.new')} value={stats.newToday} accent="secondary" />
        <Stat icon={<Phone size={14} />}     label={t('realtorQueue.stats.awaitingFollowup')} value={stats.awaitingFollowup} accent="amber" />
        <Stat icon={<Users size={14} />}     label="Hot agents" value={stats.hotLeads} accent="accent" />
      </div>

      <SourceProvenance
        chips={[{
          source: 'Bridge MLS',
          count: stats.total === 0 ? 'No sync yet' : `${stats.total} agents`,
          lastSync: lastSyncLabel,
          status: loadError ? 'pending' : stats.total > 0 ? 'connected' : 'pending',
        }]}
      />

      {loadError && (
        <div className="metric-card border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center justify-between gap-3">
          <span>Failed to load agents: {loadError}</span>
          <button
            type="button"
            onClick={() => load()}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card border text-foreground text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="metric-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={filterState}
            onChange={e => { setPage(1); setFilterState(e.target.value as 'all' | 'FL' | 'NY' | 'CA'); }}
            className="bg-muted rounded px-2 py-1 border-0 outline-none"
          >
            <option value="all">{t('realtorQueue.filters.allStates')}</option>
            <option value="FL">Florida</option>
            <option value="NY">New York</option>
            <option value="CA">California</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => { setPage(1); setFilterStatus(e.target.value as 'all' | RealtorLeadStatus); }}
            className="bg-muted rounded px-2 py-1 border-0 outline-none"
          >
            <option value="all">{t('realtorQueue.filters.allStatuses')}</option>
            <option value="New">{t('realtorQueue.status.new')}</option>
            <option value="Contacted">{t('realtorQueue.status.contacted')}</option>
            <option value="Partnered">{t('realtorQueue.status.partnered')}</option>
            <option value="Closed Won">{t('realtorQueue.status.closedWon')}</option>
            <option value="Declined">{t('realtorQueue.status.declined')}</option>
          </select>
          <select
            value={filterRep}
            onChange={e => { setPage(1); setFilterRep(e.target.value); }}
            className="bg-muted rounded px-2 py-1 border-0 outline-none"
          >
            <option value="all">All reps</option>
            <option value="unassigned">Unassigned</option>
            {repNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <button
            onClick={() => { setPage(1); setEsOnly(v => !v); }}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${esOnly ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            <Globe size={11} /> {t('realtorQueue.filters.esOnly')}
          </button>
          <button
            onClick={() => { setPage(1); setHotOnly(v => !v); }}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${hotOnly ? 'bg-speed text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            <Flame size={11} /> {t('realtorQueue.filters.hotOnly')}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs ml-auto">
          <button
            type="button"
            onClick={handleRoundRobinAssign}
            disabled={roundRobinAssigning || repNames.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary text-secondary-foreground text-[11px] font-bold hover:opacity-90 disabled:opacity-50"
            title="Distribute all unassigned leads evenly across active sales reps"
          >
            {roundRobinAssigning ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
            Round-robin assign all
          </button>
          <ArrowUpDown size={14} className="text-muted-foreground" />
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="days">{t('realtorQueue.sort.daysDesc')}</option>
            <option value="newest">{t('realtorQueue.sort.newest')}</option>
            <option value="price">{t('realtorQueue.sort.priceDesc')}</option>
            <option value="drops">{t('realtorQueue.sort.mostDrops')}</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulk.size > 0 && (
        <div className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 text-sm">
          <strong>{t('realtorQueue.bulk.selected', { count: bulk.size })}</strong>
          <span className="opacity-80">{t('realtorQueue.bulk.assignTo')}</span>
          <select value={bulkRep} onChange={e => setBulkRep(e.target.value)} className="bg-card text-foreground rounded px-2 py-1 text-xs">
            {repNames.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={applyBulk} className="ml-auto bg-accent text-accent-foreground px-3 py-1 rounded text-xs font-bold hover:opacity-90">{t('realtorQueue.bulk.assign')}</button>
          <button
            onClick={() => {
              const targets = list.filter(a => bulk.has(a.id));
              pushToMojo(targets).then(() => setBulk(new Set()));
            }}
            className="flex items-center gap-1 bg-card text-foreground px-3 py-1 rounded text-xs font-bold hover:bg-muted"
          >
            <Send size={11} /> Push to Mojo
          </button>
          <button onClick={() => setBulk(new Set())} className="text-xs opacity-70 hover:opacity-100">{t('realtorQueue.bulk.clear')}</button>
        </div>
      )}

      {/* Lead rows */}
      <div className="metric-card p-0 overflow-hidden">
        <div className="space-y-2 p-3">
        {loading && (
          <div className="text-center py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading agents…
          </div>
        )}
        {!loading && !loadError && list.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10 space-y-2">
            <p className="font-semibold text-foreground">No agent leads yet</p>
            <p className="text-xs">Run a Bridge MLS sync to populate this queue.</p>
            <p className="text-xs">Go to <a href="/ceo/sync-runs" className="text-secondary underline underline-offset-2">Sync Runs</a> → Bridge MLS → Start Sync, or enable a feed in <a href="/integrations" className="text-secondary underline underline-offset-2">Integrations → Zillow Listings → MLS Feeds</a>.</p>
          </div>
        )}
        {!loading && list.map(agent => {
          const hot = isHotAgent(agent);
          const checked = bulk.has(agent.id);
          return (
            <div
              key={agent.id}
              className={`rounded-xl border bg-card p-3 flex flex-col md:flex-row md:items-center gap-3 transition-shadow hover:shadow-md ${checked ? 'ring-2 ring-secondary' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleBulk(agent.id)}
                onClick={e => e.stopPropagation()}
                className="shrink-0 h-4 w-4 accent-current text-secondary"
                aria-label={`Select ${agent.agentName}`}
              />

              <button
                onClick={() => setDrawerAgent(agent)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">{agent.agentName}</span>
                  <span className="text-xs text-muted-foreground">· {agent.brokerage}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${statusBadge[agent.status as RealtorLeadStatus]}`}>{t(realtorStatusKey(agent.status as RealtorLeadStatus))}</span>
                  {hot && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-speed text-white font-bold flex items-center gap-1">
                      <Flame size={9} /> {t('realtorQueue.hot')}
                    </span>
                  )}
                  {agent.language === 'ES' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-bold">ES</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {agent.listingCount > 1 ? `${agent.listingCount} listings` : `MLS# ${agent.latestListingId}`}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{agent.datasetId}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin size={11} /> {agent.latestPropertyAddress}, {agent.latestCity}, {agent.latestState}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t('realtorQueue.lastContact')} {relativeTime(agent.lastContactAt)}
                </div>
              </button>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <p className="text-muted-foreground">{t('realtorQueue.list')}</p>
                  <p className="font-bold text-foreground">${(agent.latestListPrice / 1000).toFixed(0)}k</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground flex items-center gap-1 justify-end"><Calendar size={10} /> {t('realtorQueue.dom')}</p>
                  <p className={`font-bold ${agent.latestDaysOnMarket >= 90 ? 'text-speed' : 'text-foreground'}`}>{agent.latestDaysOnMarket}d</p>
                </div>
                {agent.listingCount > 1 && (
                  <div className="text-right">
                    <p className="text-muted-foreground flex items-center gap-1 justify-end"><TrendingDown size={10} /> listings</p>
                    <p className="font-bold text-speed">{agent.listingCount}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); pushToMojo([agent]); }}
                  disabled={mojoPushing.has(agent.id)}
                  className="w-8 h-8 rounded-md bg-accent/15 text-accent hover:bg-accent hover:text-accent-foreground flex items-center justify-center disabled:opacity-50"
                  title={t('realtorQueue.pushToMojoTitle')}
                >
                  {mojoPushing.has(agent.id) ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpToLine size={13} />}
                </button>
                <a
                  href={`mailto:${agent.agentEmail}`}
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 rounded-md bg-secondary/15 text-secondary hover:bg-secondary hover:text-secondary-foreground flex items-center justify-center"
                  title={t('realtorQueue.emailTitle')}
                >
                  <Mail size={13} />
                </a>
                <select
                  value={agent.assignedRep ?? 'Unassigned'}
                  onChange={e => { e.stopPropagation(); handleAssignRep(agent, e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] bg-muted rounded px-1.5 py-1 border-0 outline-none max-w-[110px]"
                  title={t('realtorQueue.assignRep')}
                >
                  {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={agent.status}
                  onChange={e => { e.stopPropagation(); handleStatusChange(agent, e.target.value as RealtorLeadStatus); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] bg-muted rounded px-1.5 py-1 border-0 outline-none max-w-[100px]"
                >
                  {(['New', 'Contacted', 'Partnered', 'Closed Won', 'Declined'] as RealtorLeadStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        </div>

        {!loadError && totalMatching > 0 && (
          <div className="px-3 py-2.5 text-[11px] text-muted-foreground bg-muted border-t flex flex-wrap items-center justify-between gap-3">
            <span>
              {t('inventory.pagination.showing')} {rangeStart.toLocaleString(loc)}–{rangeEnd.toLocaleString(loc)} {t('inventory.pagination.of')} {totalMatching.toLocaleString(loc)}
            </span>

            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-medium">{t('inventory.pagination.page')}</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyPageInput();
                    }
                  }}
                  disabled={loading || totalPages <= 1}
                  aria-label={t('inventory.buttons.goToPage')}
                  className="w-10 px-1 py-0.5 text-xs text-center font-bold text-foreground border rounded bg-card outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                />
              </span>

              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="px-2 py-1 rounded border bg-card hover:bg-background disabled:opacity-40 flex items-center gap-0.5 font-bold text-foreground"
                aria-label={t('inventory.pagination.previousPage')}
              >
                <ChevronLeft size={14} /> {t('inventory.buttons.prev')}
              </button>
              <span className="px-2 py-1 font-medium text-foreground tabular-nums whitespace-nowrap">
                {t('inventory.pagination.page')} {page.toLocaleString(loc)} {t('inventory.pagination.of')} {totalPages.toLocaleString(loc)}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-2 py-1 rounded border bg-card hover:bg-background disabled:opacity-40 flex items-center gap-0.5 font-bold text-foreground"
                aria-label={t('inventory.pagination.nextPage')}
              >
                {t('inventory.buttons.next')} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <RealtorLeadDetailDrawer
        key={drawerAgent?.id ?? 'none'}
        agent={drawerAgent ?? ({} as RealtorAgent)}
        open={!!drawerAgent}
        onOpenChange={(open) => { if (!open) setDrawerAgent(null); }}
        assignedRep={drawerAgent?.assignedRep ?? undefined}
        reps={repOptions}
        onStatusChange={handleStatusChange}
        onAssignRep={handleAssignRep}
      />
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: 'secondary' | 'amber' | 'accent' }) {
  const tone =
    accent === 'secondary' ? 'text-secondary' :
    accent === 'amber'     ? 'text-amber-700' :
    accent === 'accent'    ? 'text-accent'    : 'text-foreground';
  return (
    <div className="metric-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">{icon} {label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
