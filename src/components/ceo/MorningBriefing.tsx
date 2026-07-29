import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Users, Gavel, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';
import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';
import { PIPELINE_STAGES, type PipelineStage } from '@/data/inventoryLeads';
import {
  fetchInventoryLeads,
  fetchAllPipelineLeads,
  type InventoryStats,
} from '@/services/inventory';
import {
  fetchSheetLeadMetrics,
  categoryDisplayLabel,
  SHEET_TAB_NAMES,
  type SheetLeadMetrics,
} from '@/services/sheetsLeads';

const PIPELINE_COLORS = [
  'hsl(212,70%,37%)',
  'hsl(160,75%,24%)',
  'hsl(36,80%,28%)',
  'hsl(210,93%,17%)',
];

const EMPTY_STATS: InventoryStats = {
  sourceTotal: 0,
  newToday: 0,
  avgAttempts: 0,
  hotEquity: 0,
  auctionsLt30: 0,
  hotScore: 0,
  bySource: { Batch: 0, County: 0, Zillow: 0, Meta: 0, Manual: 0 },
};

export default function MorningBriefing() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [sheetMetrics, setSheetMetrics] = useState<SheetLeadMetrics | null>(null);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [stageCounts, setStageCounts] = useState<Record<PipelineStage, number> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [sheetsRes, invRes, pipeRes] = await Promise.all([
        fetchSheetLeadMetrics(),
        fetchInventoryLeads({ limit: 1 }),
        fetchAllPipelineLeads(),
      ]);

      if (cancelled) return;

      const errors = [sheetsRes.error, invRes.error, pipeRes.error].filter(Boolean);
      if (errors.length > 0) {
        toast.error(errors[0]!);
      }

      if (sheetsRes.metrics) setSheetMetrics(sheetsRes.metrics);
      if (invRes.stats) setInventoryStats(invRes.stats);
      if (pipeRes.stageCounts) setStageCounts(pipeRes.stageCounts);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = inventoryStats ?? EMPTY_STATS;
  const display = (n: number) => (loading ? '—' : String(n));

  const pipelineData = useMemo(
    () =>
      PIPELINE_STAGES.map((name) => ({
        name,
        count: stageCounts?.[name] ?? 0,
      })),
    [stageCounts],
  );

  const pipelineTotal = useMemo(
    () => pipelineData.reduce((sum, row) => sum + row.count, 0),
    [pipelineData],
  );

  const categoryRows = useMemo(() => {
    const counts = sheetMetrics?.countsToday ?? {};
    return SHEET_TAB_NAMES.map((tab) => ({
      key: tab,
      label: categoryDisplayLabel(tab),
      count: counts[tab] ?? 0,
    }));
  }, [sheetMetrics]);

  const categoryHasAny = categoryRows.some((row) => row.count > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('briefing.newLeadsToday')}
          value={display(sheetMetrics?.totalToday ?? 0)}
          subtitle={t('briefing.newLeadsSubtitle')}
          icon={<ArrowUp className="text-accent" size={20} />}
          accent="accent"
          pulse={!loading && (sheetMetrics?.totalToday ?? 0) > 0}
        />
        <MetricCard
          title={t('briefing.equityQualified')}
          value={display(stats.hotEquity)}
          subtitle={t('briefing.readyToCall')}
          icon={<Users className="text-secondary" size={20} />}
          accent="secondary"
        />
        <MetricCard
          title={t('briefing.auctionsLt30')}
          value={display(stats.auctionsLt30)}
          subtitle={t('briefing.auctionsLt30Subtitle')}
          icon={<Gavel className="text-primary" size={20} />}
          accent="primary"
        />
        <MetricCard
          title={t('briefing.inventoryNewToday')}
          value={display(stats.newToday)}
          subtitle={t('briefing.inventoryNewTodaySubtitle')}
          icon={<Database className="text-warning" size={20} />}
          accent="warning"
        />
      </div>

      <SpeedToLeadFeed compact />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-4">{t('briefing.activePipeline')}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pipelineData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                {pipelineData.map((_, i) => (
                  <Cell key={PIPELINE_STAGES[i]} fill={PIPELINE_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            {loading
              ? t('briefing.loading')
              : t('briefing.pipelineTotal', { count: pipelineTotal })}
          </p>
        </div>

        <div className="metric-card">
          <h3 className="font-bold text-foreground mb-4">{t('briefing.sheetCategoriesToday')}</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('briefing.loading')}</p>
          ) : !categoryHasAny ? (
            <p className="text-sm text-muted-foreground">{t('briefing.sheetCategoriesEmpty')}</p>
          ) : (
            <div className="space-y-3">
              {categoryRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  pulse,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  pulse?: boolean;
}) {
  const borderColor =
    accent === 'accent'
      ? 'border-l-accent'
      : accent === 'secondary'
        ? 'border-l-secondary'
        : accent === 'warning'
          ? 'border-l-warning'
          : 'border-l-primary';
  return (
    <div className={`metric-card border-l-4 ${borderColor} relative overflow-hidden`}>
      {pulse && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent animate-ping" />}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon}
      </div>
      <p key={value} className="text-3xl font-bold text-foreground animate-count-up">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
