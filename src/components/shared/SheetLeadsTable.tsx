import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchSheetLeads,
  leadDisplaySubtitle,
  pushSheetLeadsToMojo,
  type SheetLead,
} from '@/services/sheetsLeads';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpToLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const POLL_MS = 15_000;

function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${String(r).padStart(2, '0')}s`;
  return `${r}s`;
}

function fmtReceived(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface Props {
  tab: string;
}

export default function SheetLeadsTable({ tab }: Props) {
  const [leads, setLeads] = useState<SheetLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [pushing, setPushing] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { leads: rows, error } = await fetchSheetLeads(tab, 100);
      if (cancelled) return;
      if (!error) setLeads(rows ?? []);
      setLoading(false);
    };

    void load();
    const interval = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tab]);

  const handlePushToMojo = async (lead: SheetLead) => {
    setPushing((prev) => new Set(prev).add(lead.id));
    const result = await pushSheetLeadsToMojo([lead]);
    setPushing((prev) => {
      const next = new Set(prev);
      next.delete(lead.id);
      return next;
    });
    if (result.ok) {
      toast.success(t('speedFeed.pushedToMojo', { name: lead.owner }), {
        description: t('speedFeed.pushedToMojoDesc'),
      });
    } else {
      toast.error(result.errors[0] ?? t('speedFeed.pushFailed'));
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{t('speedTable.title', { tab })}</h3>
        <span className="text-xs text-muted-foreground">
          {t('speedTable.count', { count: leads.length })}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('speedFeed.loading')}</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">{t('speedTable.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('speedTable.name')}</TableHead>
                <TableHead>{t('speedTable.phone')}</TableHead>
                <TableHead>{t('speedTable.email')}</TableHead>
                <TableHead>{t('speedTable.address')}</TableHead>
                <TableHead>{t('speedTable.detail')}</TableHead>
                <TableHead>{t('speedTable.received')}</TableHead>
                <TableHead>{t('speedTable.age')}</TableHead>
                <TableHead className="text-right">{t('speedTable.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const ageMs = now - lead.receivedAt;
                const isPushing = pushing.has(lead.id);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.owner}</TableCell>
                    <TableCell>{lead.phone ?? '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{lead.email ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{lead.address || '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">
                      {leadDisplaySubtitle(lead)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmtReceived(lead.receivedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{fmtAge(ageMs)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => void handlePushToMojo(lead)}
                        disabled={isPushing || !lead.phone}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-speed text-speed-foreground rounded-md text-[11px] font-bold hover:opacity-90 disabled:opacity-50"
                        title={t('speedFeed.pushToTopTitle')}
                      >
                        {isPushing ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ArrowUpToLine size={12} />
                        )}
                        {t('speedFeed.pushToTop')}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
