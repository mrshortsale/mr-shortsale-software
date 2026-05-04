import { useEffect, useState } from 'react';
import { CheckCircle, Activity, Zap, Database, Facebook, PhoneCall, Layers, Settings, Building2, AlertTriangle, KeyRound } from 'lucide-react';
import { getBatchLeadsHealth } from '@/integrations/batchLeads';
import { getMetaHealth } from '@/integrations/metaAds';
import { getMojoStatus } from '@/integrations/mojoDialer';
import { getZillowHealth } from '@/integrations/zillow';

type DotColor = 'green' | 'orange' | 'gray';

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
  dot: DotColor;
  statusLabel: string;
}

const dotStyles: Record<DotColor, { bg: string; text: string }> = {
  green:  { bg: 'bg-accent',          text: 'text-accent' },
  orange: { bg: 'bg-speed',           text: 'text-speed' },
  gray:   { bg: 'bg-muted-foreground',text: 'text-muted-foreground' },
};

export default function DataSources() {
  const [sources, setSources] = useState<SourceCard[]>([]);

  useEffect(() => {
    (async () => {
      const [b, m, mojo, z] = await Promise.all([getBatchLeadsHealth(), getMetaHealth(), getMojoStatus(), getZillowHealth()]);
      setSources([
        {
          id: 'batch',
          name: 'Batch Leads API',
          badge: 'Primary · 35,000 leads/mo · 3,100 counties · ~72hr lag',
          badgeColor: 'bg-accent/15 text-accent',
          icon: <Database size={18} />,
          description: '$3.95/mo flat — distressed property leads nationwide. Key received ✓ — backend wiring pending.',
          lastSync: b.lastSync,
          records: `${b.recordsThisWeek.toLocaleString()} this week`,
          detail: `${b.monthlyQuotaUsed}% of monthly quota used · acknowledged 3-day data lag from county filings`,
          dot: 'green',
          statusLabel: 'Connected',
        },
        {
          id: 'zillow',
          name: 'Zillow Listings (Realtor Chain)',
          badge: 'Realtor leads · keyword: "short sale" · nationwide',
          badgeColor: 'bg-secondary/15 text-secondary',
          icon: <Building2 size={18} />,
          description: 'Pulls listings already on Zillow as short sales. Feeds the Realtor Short Sale chain — pitch listing agents directly.',
          lastSync: z.lastSync,
          records: `${z.totalActive} active listings · ${z.newToday} new today`,
          detail: `${z.statesCovered} states tracked · keyword filters: ${z.keywordsTracked.join(', ')}`,
          dot: 'orange',
          statusLabel: 'API key pending',
        },
        {
          id: 'attom',
          name: 'ATTOM Property Data',
          badge: 'Comparison source · pay-as-you-go · pilot: FL counties',
          badgeColor: 'bg-secondary/15 text-secondary',
          icon: <Layers size={18} />,
          description: 'Running parallel to Batch to validate freshness. AVM, equity %, owner name, last sale, tax delinquency.',
          lastSync: 'Pilot mode — sample pulls',
          records: '158M property records nationwide',
          detail: 'Phase 2: per-county source scoring will pick the freshest provider per market',
          dot: 'orange',
          statusLabel: 'Pilot',
        },
        {
          id: 'mojo',
          name: 'Mojo Triple Dialer',
          badge: 'Auto-feed active · Call outcomes syncing',
          badgeColor: 'bg-accent/15 text-accent',
          icon: <PhoneCall size={18} />,
          description: 'Bulk push leads, sync answered/voicemail/DNC outcomes back',
          lastSync: mojo.lastSync,
          records: `${mojo.callsToday} calls today`,
          detail: `${mojo.queued} in queue · ${mojo.connectRate}% connect rate`,
          dot: 'green',
          statusLabel: 'Active',
        },
        {
          id: 'meta',
          name: 'Meta / Facebook Ads',
          badge: 'Speed-to-Lead feed active',
          badgeColor: 'bg-speed/15 text-speed',
          icon: <Facebook size={18} />,
          description: 'Live form-fill webhook — instant alert + dialer routing',
          lastSync: `Last lead: ${m.lastEvent}`,
          records: `${m.weeklyRecords} this week · ${m.leadsToday} today`,
          detail: `Avg response: ${Math.floor(m.avgResponseSec / 60)}m ${m.avgResponseSec % 60}s · ${m.conversionPct}% conversion`,
          dot: 'orange',
          statusLabel: 'Live',
        },
      ]);
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Source-freshness banner (May 4 client meeting takeaway) */}
      <div className="rounded-xl border-l-4 border-l-speed bg-speed/5 p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-speed mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold text-foreground">Source freshness — known limitation</p>
          <p className="text-xs text-muted-foreground mt-1">
            Batch Leads API has a <strong>~72-hour lag</strong> from county filing. Phase 2 plan: pilot direct county-records ingestion (5 FL counties → 20 → 50) and add ATOM as a parallel comparison source so the platform can pick the freshest provider per county.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <KeyRound size={12} className="text-accent" />
            <span className="text-[11px] text-accent font-medium">Batch Leads API key received from Cristina · backend wiring in next sprint</span>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map(s => {
          const ds = dotStyles[s.dot];
          const live = s.dot !== 'gray';
          return (
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
                        {live && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ds.bg}`} />}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${ds.bg}`} />
                      </span>
                      <span className={`${ds.text} font-medium`}>{s.statusLabel}</span>
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
          );
        })}
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
          <OverlapRow a="Batch Leads" b="Meta Ads" pct={18} />
          <OverlapRow a="Batch Leads" b="Mojo (re-dial)" pct={9} />
          <OverlapRow a="Meta Ads" b="Mojo (re-dial)" pct={4} />
        </div>
      </div>

      {/* Pipeline view */}
      <div className="metric-card">
        <h3 className="font-bold text-foreground mb-4">Data Pipeline Flow</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <PipeStep icon={<Database size={14} />} label="5 Sources" sub="Batch · Zillow · ATOM · Mojo · Meta" />
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
