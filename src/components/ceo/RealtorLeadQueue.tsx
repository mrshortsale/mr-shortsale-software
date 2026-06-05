import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RealtorLead,
  RealtorLeadStatus,
  relativeTime,
  realtorLeads as mockLeads,
} from '@/data/realtorLeads';
import {
  fetchRealtorLeads,
  updateRealtorLeadStatus,
  isHotAgent,
  type RealtorAgent,
  type RealtorStats,
} from '@/services/realtor';
import {
  Phone, Mail, ExternalLink, Filter, ArrowUpDown, Calendar, MapPin,
  TrendingDown, Flame, Building2, Globe, Users, RefreshCw, ArrowUpToLine, Loader2,
} from 'lucide-react';
import { sendToMojo } from '@/integrations/mojoDialer';
import { toast } from 'sonner';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';
import SourceProvenance from '@/components/shared/SourceProvenance';

type SortKey = 'days' | 'price' | 'drops' | 'newest';

function zillowUrl(address: string, city: string, state: string): string {
  // Zillow address-based URL: spaces/commas → hyphens, lowercase
  const slug = `${address} ${city} ${state}`
    .replace(/[,#]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}/`;
}

function agentToLead(a: RealtorAgent): RealtorLead {
  return {
    id: a.id,
    agentName: a.agentName,
    brokerage: a.brokerage,
    agentPhone: a.agentPhone,
    agentEmail: a.agentEmail,
    mlsNumber: a.latestListingId,
    propertyAddress: a.latestPropertyAddress,
    city: a.latestCity,
    state: a.latestState,
    listPrice: a.latestListPrice,
    daysOnMarket: a.latestDaysOnMarket,
    priceDrops: [],
    listingUrl: a.latestPropertyAddress
      ? zillowUrl(a.latestPropertyAddress, a.latestCity, a.latestState)
      : '',
    status: a.status as RealtorLeadStatus,
    lastContactAt: a.lastContactAt,
    language: a.language as 'EN' | 'ES',
    notes: a.notes ?? undefined,
    source: 'zillow',
  };
}

const statusBadge: Record<RealtorLeadStatus, string> = {
  'New':         'bg-secondary/15 text-secondary',
  'Contacted':   'bg-amber-100 text-amber-700',
  'Partnered':   'bg-accent/15 text-accent',
  'Closed Won':  'bg-accent text-accent-foreground',
  'Declined':    'bg-muted text-muted-foreground',
};

const reps = ['Unassigned', 'Carlos M.', 'Maria L.', 'Jen R.', 'Andre P.'];

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
  const [usingMocks, setUsingMocks] = useState(false);
  const [selected, setSelected] = useState<RealtorLead | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | RealtorLeadStatus>('all');
  const [esOnly, setEsOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [bulkRep, setBulkRep] = useState('Carlos M.');
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const load = useCallback(async () => {
    setLoading(true);
    const { leads, stats: s, error } = await fetchRealtorLeads({
      statuses: filterStatus === 'all' ? undefined : [filterStatus],
      state: filterState === 'all' ? undefined : filterState,
      language: esOnly ? 'ES' : undefined,
      hotOnly,
      limit: 200,
    });
    setLoading(false);

    // Only fall back to mocks when the API itself is unreachable (local dev without edge functions)
    // An empty result is a valid state — it just means no sync has run yet.
    if (error && leads.length === 0) {
      const mapped = mockLeads.map((l) => ({
        id: l.id, profileId: '', datasetId: 'mock', externalId: l.id,
        listAgentKey: null, agentName: l.agentName, brokerage: l.brokerage,
        agentPhone: l.agentPhone, agentEmail: l.agentEmail,
        language: l.language, listingCount: l.priceDrops.length + 1,
        latestListingId: l.mlsNumber, latestPropertyAddress: l.propertyAddress,
        latestCity: l.city, latestState: l.state, latestListPrice: l.listPrice,
        latestDaysOnMarket: l.daysOnMarket, latestPublicRemarks: '',
        status: l.status as RealtorLeadStatus, lastContactAt: l.lastContactAt,
        notes: l.notes ?? null, createdAt: '', updatedAt: '',
      }) as RealtorAgent);
      setAgents(mapped);
      setStats({ total: mockLeads.length, newToday: mockLeads.filter(l => l.status === 'New').length, hotLeads: 0, awaitingFollowup: mockLeads.filter(l => l.status === 'Contacted').length, lastSyncAt: null });
      setUsingMocks(true);
    } else {
      setAgents(leads);
      setStats(s);
      setUsingMocks(false);
    }
  }, [filterStatus, filterState, esOnly, hotOnly]);

  useEffect(() => { load(); }, [load]);

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
    const next = { ...assignments };
    bulk.forEach(id => { next[id] = bulkRep; });
    setAssignments(next);
    setBulk(new Set());
  };

  const handleStatusChange = async (agent: RealtorAgent, status: RealtorLeadStatus) => {
    if (usingMocks) return;
    const { error } = await updateRealtorLeadStatus(agent.id, status);
    if (error) { toast.error(error); return; }
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status } : a));
    toast.success('Status updated');
  };

  const lastSyncLabel = stats.lastSyncAt
    ? new Date(stats.lastSyncAt).toLocaleString(loc)
    : usingMocks ? 'Mock data' : 'Never';

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
          source: usingMocks ? 'Zillow' : 'Bridge MLS',
          count: usingMocks
            ? `${stats.total} listings · Mock data`
            : stats.total === 0
              ? 'No sync yet'
              : `${stats.total} agents`,
          lastSync: lastSyncLabel,
          status: usingMocks ? 'pending' : stats.total > 0 ? 'connected' : 'pending',
        }]}
      />

      {/* Filter bar */}
      <div className="metric-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Filter size={14} className="text-muted-foreground" />
          <select value={filterState} onChange={e => setFilterState(e.target.value as 'all' | 'FL' | 'NY' | 'CA')} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="all">{t('realtorQueue.filters.allStates')}</option>
            <option value="FL">Florida</option>
            <option value="NY">New York</option>
            <option value="CA">California</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | RealtorLeadStatus)} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="all">{t('realtorQueue.filters.allStatuses')}</option>
            <option value="New">{t('realtorQueue.status.new')}</option>
            <option value="Contacted">{t('realtorQueue.status.contacted')}</option>
            <option value="Partnered">{t('realtorQueue.status.partnered')}</option>
            <option value="Closed Won">{t('realtorQueue.status.closedWon')}</option>
            <option value="Declined">{t('realtorQueue.status.declined')}</option>
          </select>
          <button
            onClick={() => setEsOnly(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${esOnly ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            <Globe size={11} /> {t('realtorQueue.filters.esOnly')}
          </button>
          <button
            onClick={() => setHotOnly(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${hotOnly ? 'bg-speed text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            <Flame size={11} /> {t('realtorQueue.filters.hotOnly')}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs ml-auto">
          <ArrowUpDown size={14} className="text-muted-foreground" />
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="bg-muted rounded px-2 py-1 border-0 outline-none">
            <option value="days">{t('realtorQueue.sort.daysDesc')}</option>
            <option value="newest">{t('realtorQueue.sort.newest')}</option>
            <option value="price">{t('realtorQueue.sort.priceDesc')}</option>
            <option value="drops">{t('realtorQueue.sort.mostDrops')}</option>
          </select>
        </div>
        <span className="text-xs text-muted-foreground">{t('realtorQueue.leadCount', { count: list.length })}</span>
      </div>

      {/* Bulk action bar */}
      {bulk.size > 0 && (
        <div className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 text-sm">
          <strong>{t('realtorQueue.bulk.selected', { count: bulk.size })}</strong>
          <span className="opacity-80">{t('realtorQueue.bulk.assignTo')}</span>
          <select value={bulkRep} onChange={e => setBulkRep(e.target.value)} className="bg-card text-foreground rounded px-2 py-1 text-xs">
            {reps.filter(r => r !== 'Unassigned').map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={applyBulk} className="ml-auto bg-accent text-accent-foreground px-3 py-1 rounded text-xs font-bold hover:opacity-90">{t('realtorQueue.bulk.assign')}</button>
          <button onClick={() => setBulk(new Set())} className="text-xs opacity-70 hover:opacity-100">{t('realtorQueue.bulk.clear')}</button>
        </div>
      )}

      {/* Lead rows */}
      <div className="space-y-2">
        {loading && (
          <div className="metric-card text-center py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading agents…
          </div>
        )}
        {!loading && list.length === 0 && !usingMocks && (
          <div className="metric-card text-center text-sm text-muted-foreground py-10 space-y-2">
            <p className="font-semibold text-foreground">No agent leads yet</p>
            <p className="text-xs">Run a Bridge MLS sync to populate this queue.</p>
            <p className="text-xs">Go to <a href="/ceo/sync-runs" className="text-secondary underline underline-offset-2">Sync Runs</a> → Bridge MLS → Start Sync, or enable a feed in <a href="/integrations" className="text-secondary underline underline-offset-2">Integrations → Zillow Listings → MLS Feeds</a>.</p>
          </div>
        )}
        {!loading && list.map(agent => {
          const hot = isHotAgent(agent);
          const checked = bulk.has(agent.id);
          const lead = agentToLead(agent);
          return (
            <div
              key={agent.id}
              className={`metric-card flex flex-col md:flex-row md:items-center gap-3 transition-shadow hover:shadow-md ${checked ? 'ring-2 ring-secondary' : ''}`}
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
                onClick={() => setSelected(lead)}
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
                  {!usingMocks && (
                    <span className="text-[10px] font-mono text-muted-foreground">{agent.datasetId}</span>
                  )}
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
                  onClick={e => { e.stopPropagation(); sendToMojo([agent.id]).then(() => toast.success(t('realtorQueue.mojoQueued', { name: agent.agentName }))); }}
                  className="w-8 h-8 rounded-md bg-accent/15 text-accent hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
                  title={t('realtorQueue.pushToMojoTitle')}
                >
                  <ArrowUpToLine size={13} />
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
                  value={assignments[agent.id] ?? 'Unassigned'}
                  onChange={e => { setAssignments(a => ({ ...a, [agent.id]: e.target.value })); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] bg-muted rounded px-1.5 py-1 border-0 outline-none max-w-[110px]"
                  title={t('realtorQueue.assignRep')}
                >
                  {reps.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {!usingMocks && (
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
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && <RealtorLeadDetailDrawer lead={selected} onClose={() => setSelected(null)} />}
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
