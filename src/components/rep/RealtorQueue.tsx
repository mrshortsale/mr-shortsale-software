import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RealtorLeadStatus,
  relativeTime,
} from '@/data/realtorLeads';
import {
  fetchRealtorLeads,
  isHotAgent,
  type RealtorAgent,
} from '@/services/realtor';
import {
  Building2, Calendar, TrendingDown, ArrowUpToLine, Mail, ExternalLink,
  Flame, RefreshCw, Filter, ArrowUpDown, Globe, Loader2,
} from 'lucide-react';
import { sendToMojo } from '@/integrations/mojoDialer';
import { toast } from 'sonner';
import RealtorLeadDetailDrawer from '@/components/shared/RealtorLeadDetailDrawer';

type SortKey = 'days' | 'newest' | 'drops';

const statusBadge: Record<RealtorLeadStatus, string> = {
  'New':         'bg-secondary/15 text-secondary',
  'Contacted':   'bg-amber-100 text-amber-700',
  'Partnered':   'bg-accent/15 text-accent',
  'Closed Won':  'bg-accent text-accent-foreground',
  'Declined':    'bg-muted text-muted-foreground',
};

export default function RealtorQueue() {
  const [agents, setAgents] = useState<RealtorAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawerAgent, setDrawerAgent] = useState<RealtorAgent | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [esOnly, setEsOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [mojoPushing, setMojoPushing] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  const pushToMojo = async (agent: RealtorAgent) => {
    setMojoPushing(prev => new Set([...prev, agent.id]));
    try {
      const result = await sendToMojo([agent]);
      if (result.ok) {
        toast.success(t('realtorQueue.mojoQueued', { name: agent.agentName }), { description: t('realtorQueueRep.pushToMojoDesc') });
      } else {
        toast.error(`Push failed: ${result.errors[0] ?? 'Unknown error'}`);
      }
    } catch (e) {
      toast.error(`Push failed: ${(e as Error).message}`);
    } finally {
      setMojoPushing(prev => { const next = new Set(prev); next.delete(agent.id); return next; });
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { leads, error } = await fetchRealtorLeads({
      statuses: ['New', 'Contacted'],
      language: esOnly ? 'ES' : undefined,
      hotOnly,
      limit: 100,
    });
    setLoading(false);
    if (error) {
      setLoadError(error);
      setAgents([]);
      return;
    }
    setLoadError(null);
    setAgents(leads);
  }, [esOnly, hotOnly]);

  useEffect(() => { load(); }, [load]);

  const queue = useMemo(() => {
    let l = [...agents];
    if (hotOnly) l = l.filter(isHotAgent);
    l.sort((a, b) => {
      if (sortKey === 'days') return b.latestDaysOnMarket - a.latestDaysOnMarket;
      if (sortKey === 'drops') return b.listingCount - a.listingCount;
      return a.latestDaysOnMarket - b.latestDaysOnMarket;
    });
    return l;
  }, [agents, sortKey, hotOnly]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-3 flex items-start gap-2">
        <Building2 className="text-secondary mt-0.5" size={16} />
        <div className="text-xs text-foreground">
          <strong>{t('realtorQueueRep.bannerTitle')}</strong> {t('realtorQueueRep.bannerBody')}
        </div>
      </div>

      <div className="rounded-xl bg-card border px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        {loading ? <Loader2 size={11} className="animate-spin text-secondary" /> : <RefreshCw size={11} className="text-secondary" />}
        <span>{t('realtorQueueRep.sourceSynced')}</span>
        <span className="ml-auto">{t('realtorQueueRep.inQueue', { count: queue.length })}</span>
      </div>

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center justify-between gap-3 px-3 py-2">
          <span>Failed to load your assigned leads: {loadError}</span>
          <button
            type="button"
            onClick={() => load()}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card border text-foreground text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Filter / sort bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-muted-foreground" />
        <button
          onClick={() => setHotOnly(v => !v)}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${hotOnly ? 'bg-speed text-white' : 'bg-muted text-muted-foreground'}`}
        >
          <Flame size={11} /> {t('realtorQueue.filters.hotOnly')}
        </button>
        <button
          onClick={() => setEsOnly(v => !v)}
          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${esOnly ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          <Globe size={11} /> {t('realtorQueue.filters.esOnly')}
        </button>
        <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpDown size={12} />
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="bg-muted rounded px-1.5 py-1 border-0 outline-none">
            <option value="days">{t('realtorQueue.sort.longestDom')}</option>
            <option value="newest">{t('realtorQueue.sort.newest')}</option>
            <option value="drops">{t('realtorQueue.sort.mostDrops')}</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && queue.length === 0 && (
        <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground">
          {t('realtorQueueRep.empty')}
        </div>
      )}

      {!loading && queue.map(agent => {
        const hot = isHotAgent(agent);
        return (
          <div
            key={agent.id}
            className="bg-card border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <button onClick={() => setDrawerAgent(agent)} className="w-full text-left">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-foreground">{agent.agentName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${statusBadge[agent.status as RealtorLeadStatus]}`}>{t(`realtorQueue.status.${agent.status === 'Closed Won' ? 'closedWon' : agent.status.toLowerCase()}`)}</span>
                {hot && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-speed text-white font-bold flex items-center gap-1">
                    <Flame size={9} /> {t('realtorQueue.hot')}
                  </span>
                )}
                {agent.language === 'ES' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-bold">ES</span>}
              </div>
              <p className="text-xs text-muted-foreground">{agent.brokerage} · MLS# {agent.latestListingId}</p>
              <p className="text-xs text-foreground mt-1">{agent.latestPropertyAddress}, {agent.latestCity}, {agent.latestState}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">${(agent.latestListPrice / 1000).toFixed(0)}k</span>
                <span className={`flex items-center gap-1 ${agent.latestDaysOnMarket >= 90 ? 'text-speed font-bold' : ''}`}>
                  <Calendar size={10} /> {agent.latestDaysOnMarket}d
                </span>
                {agent.listingCount > 1 && (
                  <span className="flex items-center gap-1 text-speed">
                    <TrendingDown size={10} /> {agent.listingCount} listings
                  </span>
                )}
                <span className="ml-auto">{t('realtorQueueRep.last')} {relativeTime(agent.lastContactAt)}</span>
              </div>
            </button>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <button
                onClick={() => pushToMojo(agent)}
                disabled={mojoPushing.has(agent.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50"
                title={t('realtorQueueRep.pushToMojoTitle')}
              >
                {mojoPushing.has(agent.id) ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpToLine size={12} />} {t('realtorQueue.pushToMojo')}
              </button>
              <a
                href={`mailto:${agent.agentEmail}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90"
              >
                <Mail size={12} /> {t('realtorQueueRep.email')}
              </a>
            </div>
          </div>
        );
      })}

      <RealtorLeadDetailDrawer
        agent={drawerAgent ?? ({} as RealtorAgent)}
        open={!!drawerAgent}
        onOpenChange={(open) => { if (!open) setDrawerAgent(null); }}
      />
    </div>
  );
}
