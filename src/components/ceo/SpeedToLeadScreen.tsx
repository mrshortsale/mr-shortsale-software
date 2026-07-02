import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';
import SheetLeadsTable from '@/components/shared/SheetLeadsTable';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSheetLeadMetrics } from '@/services/sheetsLeads';
import { Zap, TrendingUp, Facebook } from 'lucide-react';
import SourceProvenance from '@/components/shared/SourceProvenance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORY_CONFIG = [
  { id: 'ad-leads', label: 'AD Leads', dataSource: 'AD Leads' },
  { id: 'new-campaign', label: 'New Campaign', dataSource: 'New Campaign Leads' },
  { id: 'updated-leads', label: 'Updated Leads', dataSource: 'Updated Leads' },
  { id: 'realtors', label: 'Realtors', dataSource: 'realtors' },
] as const;

export default function SpeedToLeadScreen() {
  const [totalToday, setTotalToday] = useState<number | null>(null);
  const [totalAll, setTotalAll] = useState<number | null>(null);
  const [countsToday, setCountsToday] = useState<Record<string, number>>({});
  const [countsTotal, setCountsTotal] = useState<Record<string, number>>({});
  const { t } = useTranslation();

  useEffect(() => {
    const load = () => {
      fetchSheetLeadMetrics().then(({ metrics, error }) => {
        if (error || !metrics) return;
        setTotalToday(metrics.totalToday);
        setTotalAll(metrics.totalAll);
        setCountsToday(metrics.countsToday);
        setCountsTotal(metrics.countsTotal);
      });
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <SourceProvenance
        chips={[
          {
            source: 'Meta',
            count: `${totalToday ?? 0} today`,
            lastSync: t('speed.live'),
            status: 'live',
          },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Metric
          label={t('speed.leadsToday')}
          value={totalToday ?? '—'}
          icon={<Facebook size={18} className="text-speed" />}
        />
        <Metric
          label={t('speed.totalLeads')}
          value={totalAll ?? '—'}
          icon={<Facebook size={18} className="text-secondary" />}
        />
        <Metric
          label={t('speed.topCategoryToday')}
          value={topCategoryLabel(countsToday)}
          icon={<TrendingUp size={18} className="text-accent" />}
        />
        <Metric
          label={t('speed.status')}
          value={t('speed.live')}
          icon={<Zap size={18} className="text-speed" />}
        />
      </div>

      <SpeedToLeadFeed maxLeads={5} />

      <Tabs defaultValue="ad-leads" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 h-auto gap-1">
          {CATEGORY_CONFIG.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="text-xs sm:text-sm py-2 whitespace-normal text-left">
              {t('speed.categoryBadge', {
                label: cat.label,
                total: countsTotal[cat.dataSource] ?? 0,
                today: countsToday[cat.dataSource] ?? 0,
              })}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORY_CONFIG.map((cat) => (
          <TabsContent key={cat.id} value={cat.id}>
            <SheetLeadsTable
              category={cat.dataSource}
              categoryLabel={cat.label}
              initialTotal={countsTotal[cat.dataSource]}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="metric-card border-l-4 border-l-speed">
        <h3 className="font-bold text-foreground mb-1">{t('speed.howItWorks')}</h3>
        <p className="text-[11px] text-muted-foreground mb-2 italic">{t('speed.howItWorksNote')}</p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
          <li>{t('speed.step1')}</li>
          <li>{t('speed.step2')}</li>
          <li>{t('speed.step3')}</li>
          <li>{t('speed.step4')}</li>
        </ol>
      </div>
    </div>
  );
}

function topCategoryLabel(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '—';
  const [topKey, topCount] = entries.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  );
  if (!topCount) return '—';
  const match = CATEGORY_CONFIG.find((c) => c.dataSource === topKey);
  return match?.label ?? topKey;
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
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
