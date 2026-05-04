import { realtorLeads, realtorPipelineStages } from '@/data/realtorLeads';
import { TrendingUp, Building2, DollarSign, Users, Award } from 'lucide-react';

export default function RealtorReports() {
  const totalLeads = realtorLeads.length;
  const partnered = realtorLeads.filter(l => l.status === 'Partnered').length;
  const closedWon = realtorLeads.filter(l => l.status === 'Closed Won').length;
  const declined  = realtorLeads.filter(l => l.status === 'Declined').length;
  const partnerRate = ((partnered + closedWon) / totalLeads * 100).toFixed(1);

  const totalValueClosed = realtorLeads.filter(l => l.status === 'Closed Won').reduce((s, l) => s + l.listPrice, 0);
  const pipelineValue = realtorLeads.filter(l => l.status === 'Partnered').reduce((s, l) => s + l.listPrice, 0);

  const byBrokerage = realtorLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.brokerage] = (acc[l.brokerage] || 0) + 1;
    return acc;
  }, {});
  const topBrokerages = Object.entries(byBrokerage).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={<Building2 size={16} />} label="Realtor leads" value={totalLeads.toString()} sub="this month" />
        <KPI icon={<Users size={16} />} label="Partner rate" value={`${partnerRate}%`} sub={`${partnered + closedWon} of ${totalLeads}`} accent />
        <KPI icon={<DollarSign size={16} />} label="Pipeline value" value={`$${(pipelineValue / 1000000).toFixed(2)}M`} sub="partnered listings" />
        <KPI icon={<Award size={16} />} label="Closed Won" value={`$${(totalValueClosed / 1000000).toFixed(2)}M`} sub={`${closedWon} deal${closedWon === 1 ? '' : 's'}`} accent />
      </div>

      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-secondary" /> Funnel by stage</h3>
        <div className="space-y-2">
          {realtorPipelineStages.map(stage => {
            const count = realtorLeads.filter(l => l.status === stage).length;
            const pct = (count / totalLeads) * 100;
            return (
              <div key={stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{stage}</span>
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
          <h3 className="font-bold text-foreground mb-3">Top brokerages by lead volume</h3>
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
          <h3 className="font-bold text-foreground mb-2">Foreclosure vs Realtor chain</h3>
          <p className="text-xs text-muted-foreground mb-3">Both pipelines run in parallel. Realtor chain has higher partner rate but lower volume — quality over quantity.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Foreclosure</p>
              <p className="text-lg font-bold text-foreground mt-0.5">~12%</p>
              <p className="text-[10px] text-muted-foreground">homeowner conversion</p>
            </div>
            <div className="rounded-lg bg-accent/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-accent">Realtor</p>
              <p className="text-lg font-bold text-accent mt-0.5">{partnerRate}%</p>
              <p className="text-[10px] text-muted-foreground">listing-agent partnership</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic mt-3">Realtor leads are warmer — listing already exists, seller already motivated.</p>
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
