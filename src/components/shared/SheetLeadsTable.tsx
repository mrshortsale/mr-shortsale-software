import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchSheetLeads,
  leadDisplaySubtitle,
  type SheetLead,
} from '@/services/sheetsLeads';
import { assignRep, fetchReps, type InventoryRep } from '@/services/inventory';
import InventoryRepPicker from '@/components/ceo/InventoryRepPicker';
import TablePagination from '@/components/shared/TablePagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const POLL_MS = 15_000;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
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
  category: string;
  categoryLabel: string;
  initialTotal?: number;
}

export default function SheetLeadsTable({ category, categoryLabel, initialTotal }: Props) {
  const [leads, setLeads] = useState<SheetLead[]>([]);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [reps, setReps] = useState<InventoryRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [now, setNow] = useState(Date.now());
  const { t } = useTranslation();

  const repNameById = useMemo(
    () => new Map(reps.map((r) => [r.id, r.name])),
    [reps],
  );

  useEffect(() => {
    setPage(1);
  }, [category]);

  useEffect(() => {
    if (initialTotal !== undefined) setTotal(initialTotal);
  }, [initialTotal]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    fetchReps().then(({ reps: fetched }) => {
      if (fetched) setReps(fetched);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const offset = (page - 1) * pageSize;
      const { leads: rows, total: fetchedTotal, error } = await fetchSheetLeads(category, {
        limit: pageSize,
        offset,
      });
      if (cancelled) return;
      if (!error) {
        setLeads(rows ?? []);
        if (fetchedTotal !== undefined) setTotal(fetchedTotal);
      }
      setLoading(false);
    };

    setLoading(true);
    void load();
    const interval = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [category, page, pageSize]);

  const handleAssign = async (lead: SheetLead, repId: string | null) => {
    const { error } = await assignRep([lead.id], repId);
    if (error) {
      toast.error(error);
      return;
    }

    const repName = repId ? repNameById.get(repId) ?? null : null;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? { ...l, assignedRepId: repId, assignedRepName: repName }
          : l,
      ),
    );

    toast.success(
      repId
        ? t('inventory.toasts.assigned', {
            count: 1,
            rep: repName ?? t('speedTable.assignedRep'),
          })
        : t('inventory.toasts.unassigned', { count: 1 }),
    );
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          {t('speedTable.title', { category: categoryLabel })}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t('speedTable.countTotal', { count: total })}
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
                <TableHead>{t('speedTable.assignedRep')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const ageMs = now - lead.receivedAt;
                const repColor =
                  reps.find((r) => r.id === lead.assignedRepId)?.avatar_color ?? '#185FA5';
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
                    <TableCell>
                      <InventoryRepPicker
                        trigger={
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 hover:bg-muted transition-colors max-w-[160px]"
                            title={t('inventory.buttons.assignRep')}
                          >
                            {lead.assignedRepName ? (
                              <>
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                  style={{ background: repColor }}
                                >
                                  {lead.assignedRepName.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="truncate font-medium text-foreground">
                                  {lead.assignedRepName}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">{t('speedTable.unassigned')}</span>
                            )}
                            <ChevronDown size={12} className="text-muted-foreground shrink-0" />
                          </button>
                        }
                        onPick={(repId) => void handleAssign(lead, repId)}
                        allowUnassign={Boolean(lead.assignedRepId)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        disabled={loading}
      />
    </div>
  );
}
