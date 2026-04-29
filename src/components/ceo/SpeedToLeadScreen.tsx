import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';
import { useEffect, useState } from 'react';
import { getMetaHealth, MetaHealth } from '@/integrations/metaAds';
import { Facebook, Zap, Clock, TrendingUp } from 'lucide-react';

export default function SpeedToLeadScreen() {
  const [m, setM] = useState<MetaHealth | null>(null);
  useEffect(() => { getMetaHealth().then(setM); }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Metric label="Leads Today" value={m?.leadsToday ?? '—'} icon={<Facebook size={18} className="text-speed" />} />
        <Metric label="Avg Response" value={m ? `${Math.floor(m.avgResponseSec / 60)}m ${m.avgResponseSec % 60}s` : '—'} icon={<Clock size={18} className="text-secondary" />} />
        <Metric label="Conversion %" value={`${m?.conversionPct ?? '—'}%`} icon={<TrendingUp size={18} className="text-accent" />} />
        <Metric label="Status" value="Live" icon={<Zap size={18} className="text-speed" />} />
      </div>

      <SpeedToLeadFeed />

      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-2">How Speed-to-Lead works</h3>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
          <li>Meta Ads form-fill triggers webhook in &lt; 1 second</li>
          <li>Lead drops into this feed — orange alert + optional sound</li>
          <li>Timer counts up: turns red after 5 min (industry kill zone)</li>
          <li>One-click <strong>Call Now</strong> pauses Mojo queue and routes lead to top</li>
          <li>After call, rep logs outcome → lead enters normal pipeline</li>
        </ol>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
