import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';
import { useEffect, useState } from 'react';
import { getMetaHealth, MetaHealth } from '@/integrations/metaAds';
import { Facebook, Zap, Clock, TrendingUp } from 'lucide-react';
import SourceProvenance from '@/components/shared/SourceProvenance';

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

      <div className="metric-card border-l-4 border-l-speed">
        <h3 className="font-bold text-foreground mb-1">How Speed-to-Lead works</h3>
        <p className="text-[11px] text-muted-foreground mb-2 italic">
          Note: Mr. Short Sale app does not place calls. All dialing happens inside Mojo Triple Dialer — we just push leads to it via API.
        </p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
          <li>Meta Ads form-fill triggers webhook in &lt; 1 second</li>
          <li>Lead drops into this feed — orange alert + optional sound</li>
          <li>Timer counts up: turns red after 5 min (industry kill zone)</li>
          <li>One-click <strong>Push to Top</strong> moves the lead to position 1 in your Mojo queue — Mojo dials it on your next pickup</li>
          <li>After call, rep logs outcome in Mojo → outcome syncs back into the pipeline</li>
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
