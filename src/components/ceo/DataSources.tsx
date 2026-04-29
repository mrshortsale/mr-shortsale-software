import { useEffect, useState } from 'react';
import { CheckCircle, Activity, Zap, Database, Facebook, FileText, Settings, Layers } from 'lucide-react';
import { getBatchLeadsHealth } from '@/integrations/batchLeads';
import { getAttomHealth } from '@/integrations/attom';
import { getMetaHealth } from '@/integrations/metaAds';

interface SourceCard {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  description: string;
  lastSync: string;
  records: string;
  detail: string;
}

export default function DataSources() {
  const [sources, setSources] = useState<SourceCard[]>([]);

  useEffect(() => {
    (async () => {
      const [b, a, m] = await Promise.all([getBatchLeadsHealth(), getAttomHealth(), getMetaHealth()]);
      setSources([
        {
          id: 'batch',
          name: 'Batch Leads API',
          badge: 'Primary — 3,100 Counties',
          badgeColor: 'bg-accent/15 text-accent',
          icon: <Database size={18} />,
          description: '$3.95/mo flat — 35,000 distressed property leads/mo nationwide',
          lastSync: b.lastSync,
          records: `${b.recordsThisWeek.toLocaleString()} this week`,
          detail: `${b.monthlyQuotaUsed}% of monthly quota used`,
        },
        {
          id: 'attom',
          name: 'ATTOM Property Data',
          badge: 'Cross-Verification',
          badgeColor: 'bg-secondary/15 text-secondary',
          icon: <Layers size={18} />,
          description: 'AVM, equity %, owner name, last sale, tax delinquency',
          lastSync: a.lastSync,
          records: `${a.recordsThisWeek.toLocaleString()} verified this week`,
          detail: '158M property records nationwide',
        },
        {
          id: 'meta',
          name: 'Meta / Facebook Ads',
          badge: 'Speed-to-Lead',
          badgeColor: 'bg-speed/15 text-speed',
          icon: <Facebook size={18} />,
          description: 'Live form-fill webhook — instant alert + dialer routing',
          lastSync: `Last lead: ${m.lastEvent}`,
          records: `${m.weeklyRecords} this week · ${m.leadsToday} today`,
          detail: `Avg response: ${Math.floor(m.avgResponseSec / 60)}m ${m.avgResponseSec % 60}s · ${m.conversionPct}% conversion`,
        },
        {
          id: 'scraper',
          name: 'County Filings Scraper',
          badge: 'Nationwide — 3,100 Counties',
          badgeColor: 'bg-warning/15 text-warning',
          icon: <FileText size={18} />,
          description: 'Daily scrape of NOD, NTS, Lis Pendens public records',
          lastSync: 'Today 5:48 AM',
          records: '619 filings this week',
          detail: 'Fallback for counties without API coverage',
        },
      ]);
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map(s => (
          <div key={s.id} className="metric-card">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground">{s.name}</h3>
                  <span className="flex items-center gap-1 text-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                    <span className="text-accent font-medium">Active</span>
                  </span>
                </div>
                <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded ${s.badgeColor}`}>{s.badge}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{s.description}</p>
            <div className="space-y-1.5 text-sm border-t pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Last sync</span>
                <span className="text-foreground text-xs font-medium">{s.lastSync}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Records</span>
                <span className="text-foreground text-xs font-medium">{s.records}</span>
              </div>
              <p className="text-[11px] text-muted-foreground italic pt-1">{s.detail}</p>
            </div>
            <button className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 border rounded-md text-xs font-medium text-muted-foreground hover:bg-muted">
              <Settings size={12} /> Configure
            </button>
          </div>
        ))}
      </div>

      {/* Dedup Engine card */}
      <div className="metric-card border-l-4 border-l-secondary">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-secondary" size={18} />
          <h3 className="font-bold text-foreground">Dedup Engine — Cross-Source Matching</h3>
          <span className="ml-auto text-xs text-accent font-medium flex items-center gap-1">
            <CheckCircle size={12} /> Running
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Duplicates removed" value="847" sub="this week" />
          <Stat label="Auto-merged" value="312" sub="cross-source matches" />
          <Stat label="Unique leads" value="1,914" sub="after dedup" />
          <Stat label="Match accuracy" value="98.4%" sub="address + APN" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <OverlapRow a="Batch Leads" b="ATTOM" pct={62} />
          <OverlapRow a="Batch Leads" b="Scraper" pct={41} />
          <OverlapRow a="ATTOM" b="Scraper" pct={28} />
        </div>
      </div>

      {/* Pipeline view */}
      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-4">Data Pipeline Flow</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <PipeStep icon={<Database size={14} />} label="4 Sources" sub="Batch · ATTOM · Meta · Scraper" />
          <Arrow />
          <PipeStep icon={<Activity size={14} />} label="Dedup Engine" sub="address + APN match" highlight />
          <Arrow />
          <PipeStep icon={<Zap size={14} />} label="AI Scoring" sub="urgency 1–10 · ICP fit" />
          <Arrow />
          <PipeStep icon={<CheckCircle size={14} />} label="Lead Queue" sub="ranked · enriched" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function OverlapRow({ a, b, pct }: { a: string; b: string; pct: number }) {
  return (
    <div className="rounded border p-2">
      <div className="flex justify-between mb-1">
        <span className="text-foreground font-medium">{a} ↔ {b}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PipeStep({ icon, label, sub, highlight }: { icon: React.ReactNode; label: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`shrink-0 rounded-lg border px-3 py-2.5 min-w-[150px] ${highlight ? 'border-secondary bg-secondary/5' : 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">{icon}{label}</div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function Arrow() {
  return <span className="text-muted-foreground shrink-0">→</span>;
}
