import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  realtorLeads,
  RealtorLead,
  RealtorLeadStatus,
  isHotRealtorLead,
  relativeTime,
} from '@/data/realtorLeads';
import {
  Building2, Calendar, TrendingDown, ArrowUpToLine, Mail, ExternalLink,
  Flame, RefreshCw, Filter, ArrowUpDown, Globe,
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
  const [selected, setSelected] = useState<RealtorLead | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [esOnly, setEsOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const { t } = useTranslation();

  const queue = useMemo(() => {
    let l = realtorLeads.filter(x => x.status === 'New' || x.status === 'Contacted');
    if (esOnly) l = l.filter(x => x.language === 'ES');
    if (hotOnly) l = l.filter(isHotRealtorLead);
    l.sort((a, b) => {
      if (sortKey === 'days') return b.daysOnMarket - a.daysOnMarket;
      if (sortKey === 'drops') return b.priceDrops.length - a.priceDrops.length;
      return a.daysOnMarket - b.daysOnMarket;
    });
    return l;
  }, [sortKey, esOnly, hotOnly]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-3 flex items-start gap-2">
        <Building2 className="text-secondary mt-0.5" size={16} />
        <div className="text-xs text-foreground">
          <strong>{t('realtorQueueRep.bannerTitle')}</strong> {t('realtorQueueRep.bannerBody')}
        </div>
      </div>

      <div className="rounded-xl bg-card border px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <RefreshCw size={11} className="text-secondary" />
        <span>{t('realtorQueueRep.sourceSynced')}</span>
        <span className="ml-auto">{t('realtorQueueRep.inQueue', { count: queue.length })}</span>
      </div>

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

      {queue.length === 0 && (
        <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground">
          {t('realtorQueueRep.empty')}
        </div>
      )}

      {queue.map(lead => {
        const hot = isHotRealtorLead(lead);
        return (
          <div
            key={lead.id}
            className="bg-card border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <button onClick={() => setSelected(lead)} className="w-full text-left">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-foreground">{lead.agentName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${statusBadge[lead.status]}`}>{t(`realtorQueue.status.${lead.status === 'Closed Won' ? 'closedWon' : lead.status.toLowerCase()}`)}</span>
                {hot && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-speed text-white font-bold flex items-center gap-1">
                    <Flame size={9} /> {t('realtorQueue.hot')}
                  </span>
                )}
                {lead.language === 'ES' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-bold">ES</span>}
              </div>
              <p className="text-xs text-muted-foreground">{lead.brokerage} · MLS# {lead.mlsNumber}</p>
              <p className="text-xs text-foreground mt-1">{lead.propertyAddress}, {lead.city}, {lead.state}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">${(lead.listPrice / 1000).toFixed(0)}k</span>
                <span className={`flex items-center gap-1 ${lead.daysOnMarket >= 90 ? 'text-speed font-bold' : ''}`}>
                  <Calendar size={10} /> {lead.daysOnMarket}d
                </span>
                {lead.priceDrops.length > 0 && (
                  <span className="flex items-center gap-1 text-speed">
                    <TrendingDown size={10} /> {t('realtorQueueRep.dropsCount', { count: lead.priceDrops.length })}
                  </span>
                )}
                <span className="ml-auto">{t('realtorQueueRep.last')} {relativeTime(lead.lastContactAt)}</span>
              </div>
            </button>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <button
                onClick={() => sendToMojo([lead.id]).then(() => toast.success(t('realtorQueue.mojoQueued', { name: lead.agentName }), { description: t('realtorQueueRep.pushToMojoDesc') }))}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-bold hover:opacity-90"
                title={t('realtorQueueRep.pushToMojoTitle')}
              >
                <ArrowUpToLine size={12} /> {t('realtorQueue.pushToMojo')}
              </button>
              <a
                href={`mailto:${lead.agentEmail}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90"
              >
                <Mail size={12} /> {t('realtorQueueRep.email')}
              </a>
              <a
                href={lead.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-muted text-foreground text-xs font-bold hover:bg-muted/70"
              >
                <ExternalLink size={12} /> {t('realtorQueueRep.listing')}
              </a>
            </div>
          </div>
        );
      })}

      {selected && <RealtorLeadDetailDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
