import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { realtorPipelineStages, realtorLeads as mockLeads, type RealtorLead } from '@/data/realtorLeads';
import { fetchRealtorLeads, type RealtorAgent } from '@/services/realtor';
import { TrendingUp, Building2, DollarSign, Users, Award } from 'lucide-react';

function agentToLead(a: RealtorAgent): RealtorLead {
  return {
    id: a.id, agentName: a.agentName, brokerage: a.brokerage,
    agentPhone: a.agentPhone, agentEmail: a.agentEmail,
    mlsNumber: a.latestListingId, propertyAddress: a.latestPropertyAddress,
    city: a.latestCity, state: a.latestState,
    listPrice: a.latestListPrice, daysOnMarket: a.latestDaysOnMarket,
    priceDrops: [], listingUrl: a.latestPropertyAddress ? `https://www.zillow.com/homes/${encodeURIComponent(`${a.latestPropertyAddress} ${a.latestCity} ${a.latestState}`.replace(/[,#]/g,'').replace(/\s+/g,'-'))}/` : '',
    status: a.status as import('@/data/realtorLeads').RealtorLeadStatus,
    lastContactAt: a.lastContactAt,
    language: a.language as 'EN' | 'ES', source: 'zillow',
  };
}

function realtorStatusKey(status: string): string {
  const map: Record<string, string> = {
    'New': 'realtorQueue.status.new',
    'Contacted': 'realtorQueue.status.contacted',
    'Partnered': 'realtorQueue.status.partnered',
    'Closed Won': 'realtorQueue.status.closedWon',
    'Declined': 'realtorQueue.status.declined',
  };
  return map[status] ?? status;
}

export default function RealtorReports() {
  const [allLeads, setAllLeads] = useState<RealtorLead[]>(mockLeads);
  const { t } = useTranslation();

  const load = useCallback(async () => {
    const { leads: agents, error } = await fetchRealtorLeads({ limit: 200 });
    if (!error && agents.length > 0) setAllLeads(agents.map(agentToLead));
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalLeads = allLeads.length;
  const partnered = allLeads.filter(l => l.status === 'Partnered').length;
  const closedWon = allLeads.filter(l => l.status === 'Closed Won').length;
  const partnerRate = totalLeads > 0 ? ((partnered + closedWon) / totalLeads * 100).toFixed(1) : '0.0';

  const totalValueClosed = allLeads.filter(l => l.status === 'Closed Won').reduce((s, l) => s + l.listPrice, 0);
  const pipelineValue = allLeads.filter(l => l.status === 'Partnered').reduce((s, l) => s + l.listPrice, 0);

  const byBrokerage = allLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.brokerage] = (acc[l.brokerage] || 0) + 1;
    return acc;
  }, {});
  const topBrokerages = Object.entries(byBrokerage).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={<Building2 size={16} />} label={t('realtorReports.kpi.realtorLeads')} value={totalLeads.toString()} sub={t('realtorReports.kpi.thisMonth')} />
        <KPI icon={<Users size={16} />} label={t('realtorReports.kpi.partnerRate')} value={`${partnerRate}%`} sub={t('realtorReports.kpi.ofTotal', { partnered: partnered + closedWon, total: totalLeads })} accent />
        <KPI icon={<DollarSign size={16} />} label={t('realtorReports.kpi.pipelineValue')} value={`$${(pipelineValue / 1000000).toFixed(2)}M`} sub={t('realtorReports.kpi.partneredListings')} />
        <KPI icon={<Award size={16} />} label={t('realtorReports.kpi.closedWon')} value={`$${(totalValueClosed / 1000000).toFixed(2)}M`} sub={t('realtorReports.kpi.deals', { count: closedWon })} accent />
      </div>

      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-secondary" /> {t('realtorReports.funnelByStage')}</h3>
        <div className="space-y-2">
          {realtorPipelineStages.map(stage => {
            const count = allLeads.filter(l => l.status === stage).length;
            const pct = (count / totalLeads) * 100;
            return (
              <div key={stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{t(realtorStatusKey(stage))}</span>
                  <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-3">{t('realtorReports.topBrokerages')}</h3>
          <div className="space-y-2">
            {topBrokerages.map(([brokerage, count]) => (
              <div key={brokerage} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{brokerage}</span>
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="metric-card border-l-4 border-l-accent">
          <h3 className="font-bold text-foreground mb-2">{t('realtorReports.comparisonTitle')}</h3>
          <p className="text-xs text-muted-foreground mb-3">{t('realtorReports.comparisonSubtitle')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('realtorReports.foreclosure')}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">~12%</p>
              <p className="text-[10px] text-muted-foreground">{t('realtorReports.homeownerConversion')}</p>
            </div>
            <div className="rounded-lg bg-accent/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-accent">{t('realtorReports.realtor')}</p>
              <p className="text-lg font-bold text-accent mt-0.5">{partnerRate}%</p>
              <p className="text-[10px] text-muted-foreground">{t('realtorReports.listingAgentPartnership')}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic mt-3">{t('realtorReports.warmerLeads')}</p>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`metric-card ${accent ? 'border-l-4 border-l-accent' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
