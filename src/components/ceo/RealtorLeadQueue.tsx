import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  realtorLeads,
  RealtorLead,
  RealtorLeadStatus,
  isHotRealtorLead,
  relativeTime,
  realtorQueueStats,
} from '@/data/realtorLeads';
import {
  Phone, Mail, ExternalLink, Filter, ArrowUpDown, Calendar, MapPin,
  TrendingDown, Flame, Building2, Globe, Users, RefreshCw, ArrowUpToLine,
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
  const [selected, setSelected] = useState<RealtorLead | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [filterState, setFilterState] = useState<'all' | 'FL' | 'NY' | 'CA'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | RealtorLeadStatus>('all');
  const [esOnly, setEsOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [bulkRep, setBulkRep] = useState('Carlos M.');
  const { t } = useTranslation();

  const list = useMemo(() => {
    let l = [...realtorLeads];
    if (filterState !== 'all') l = l.filter(x => x.state === filterState);
    if (filterStatus !== 'all') l = l.filter(x => x.status === filterStatus);
    if (esOnly) l = l.filter(x => x.language === 'ES');
    if (hotOnly) l = l.filter(isHotRealtorLead);
    l.sort((a, b) => {
      if (sortKey === 'days') return b.daysOnMarket - a.daysOnMarket;
      if (sortKey === 'price') return b.listPrice - a.listPrice;
      if (sortKey === 'drops') return b.priceDrops.length - a.priceDrops.length;
      // newest = lowest DOM
      return a.daysOnMarket - b.daysOnMarket;
    });
    return l;
  }, [sortKey, filterState, filterStatus, esOnly, hotOnly]);

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

  return (
    <div className="space-y-4">
      {/* Header strip — stats + freshness */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Building2 size={14} />} label={t('realtorQueue.stats.total')} value={realtorQueueStats.total} />
        <Stat icon={<Flame size={14} />}     label={t('realtorQueue.stats.new')} value={realtorQueueStats.newToday} accent="secondary" />
        <Stat icon={<Phone size={14} />}     label={t('realtorQueue.stats.awaitingFollowup')} value={realtorQueueStats.awaitingFollowup} accent="amber" />
        <Stat icon={<Users size={14} />}     label={t('realtorQueue.stats.partnered')} value={realtorQueueStats.partneredThisWeek} accent="accent" />
      </div>

      <SourceProvenance
        chips={[{ source: 'Zillow', count: t('realtorQueue.listingsCount', { count: realtorQueueStats.total }), lastSync: '12m ago', status: 'pending' }]}
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
        {list.length === 0 && (
          <div className="metric-card text-center text-sm text-muted-foreground py-8">
            {t('realtorQueue.empty')}
          </div>
        )}
        {list.map(lead => {
          const hot = isHotRealtorLead(lead);
          const checked = bulk.has(lead.id);
          return (
            <div
              key={lead.id}
              className={`metric-card flex flex-col md:flex-row md:items-center gap-3 transition-shadow hover:shadow-md ${checked ? 'ring-2 ring-secondary' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleBulk(lead.id)}
                onClick={e => e.stopPropagation()}
                className="shrink-0 h-4 w-4 accent-current text-secondary"
                aria-label={`Select ${lead.agentName}`}
              />

              <button
                onClick={() => setSelected(lead)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">{lead.agentName}</span>
                  <span className="text-xs text-muted-foreground">· {lead.brokerage}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${statusBadge[lead.status]}`}>{t(realtorStatusKey(lead.status))}</span>
                  {hot && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-speed text-white font-bold flex items-center gap-1">
                      <Flame size={9} /> {t('realtorQueue.hot')}
                    </span>
                  )}
                  {lead.language === 'ES' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-bold">ES</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">MLS# {lead.mlsNumber}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin size={11} /> {lead.propertyAddress}, {lead.city}, {lead.state}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t('realtorQueue.lastContact')} {relativeTime(lead.lastContactAt)}
                </div>
              </button>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <p className="text-muted-foreground">{t('realtorQueue.list')}</p>
                  <p className="font-bold text-foreground">${(lead.listPrice / 1000).toFixed(0)}k</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground flex items-center gap-1 justify-end"><Calendar size={10} /> {t('realtorQueue.dom')}</p>
                  <p className={`font-bold ${lead.daysOnMarket >= 90 ? 'text-speed' : 'text-foreground'}`}>{lead.daysOnMarket}d</p>
                </div>
                {lead.priceDrops.length > 0 && (
                  <div className="text-right">
                    <p className="text-muted-foreground flex items-center gap-1 justify-end"><TrendingDown size={10} /> {t('realtorQueue.drops')}</p>
                    <p className="font-bold text-speed">{lead.priceDrops.length}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); sendToMojo([lead.id]).then(() => toast.success(t('realtorQueue.mojoQueued', { name: lead.agentName }))); }}
                  className="w-8 h-8 rounded-md bg-accent/15 text-accent hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
                  title={t('realtorQueue.pushToMojoTitle')}
                >
                  <ArrowUpToLine size={13} />
                </button>
                <a
                  href={`mailto:${lead.agentEmail}`}
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 rounded-md bg-secondary/15 text-secondary hover:bg-secondary hover:text-secondary-foreground flex items-center justify-center"
                  title={t('realtorQueue.emailTitle')}
                >
                  <Mail size={13} />
                </a>
                <a
                  href={lead.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 rounded-md bg-muted text-foreground hover:bg-muted/70 flex items-center justify-center"
                  title={t('realtorQueue.listingTitle')}
                >
                  <ExternalLink size={13} />
                </a>
                <select
                  value={assignments[lead.id] ?? 'Unassigned'}
                  onChange={e => { setAssignments(a => ({ ...a, [lead.id]: e.target.value })); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] bg-muted rounded px-1.5 py-1 border-0 outline-none max-w-[110px]"
                  title={t('realtorQueue.assignRep')}
                >
                  {reps.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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
