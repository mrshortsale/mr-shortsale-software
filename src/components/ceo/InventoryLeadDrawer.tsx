import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import InventoryRepPicker from '@/components/ceo/InventoryRepPicker';
import {
  AlertTriangle, ArrowRightCircle, ArrowUpToLine, Copy, EyeOff,
  Flame, Mail, MapPin, Phone, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { InventoryLead, InventoryStatus } from '@/data/inventoryLeads';

interface Props {
  lead: InventoryLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repNameById: Map<string, string>;
  onAssignRep: (lead: InventoryLead, repId: string | null) => void | Promise<void>;
  onStatusChange: (lead: InventoryLead, status: InventoryStatus) => void;
  onPushToMojo: (lead: InventoryLead) => void;
}

const scoreColor = (s: number) =>
  s >= 9 ? 'bg-destructive text-destructive-foreground' :
  s >= 7 ? 'bg-orange-500 text-white' :
  s >= 5 ? 'bg-amber-100 text-amber-700' :
  'bg-muted text-muted-foreground';

const filingColor = (t?: string | null) =>
  t === 'NOD' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
  t === 'NTS' ? 'bg-destructive/10 text-destructive border border-destructive/30' :
  t === 'LP' ? 'bg-purple-100 text-purple-700 border border-purple-300' :
  'bg-muted text-muted-foreground border';

const statusColor = (s: InventoryStatus) =>
  s === 'New' ? 'bg-primary/10 text-primary border border-primary/30' :
  s === 'Contacted' ? 'bg-accent/10 text-accent border border-accent/30' :
  s === 'Promoted' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
  'bg-muted text-muted-foreground border';

function formatRelative(ms: number | null | undefined, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('inventoryDrawer.justNow');
  if (mins < 60) return t('inventoryDrawer.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return t('inventoryDrawer.hoursAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('inventoryDrawer.daysAgo', { count: days });
}

export default function InventoryLeadDrawer({
  lead, open, onOpenChange, repNameById, onAssignRep, onStatusChange, onPushToMojo,
}: Props) {
  const { t } = useTranslation();
  if (!lead) return null;

  const hot = lead.score >= 8;
  const assignedName = lead.assignedRepId ? repNameById.get(lead.assignedRepId) ?? '—' : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="bg-primary text-primary-foreground p-6">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className={`shrink-0 px-3 py-2 rounded-lg font-bold text-lg ${scoreColor(lead.score)}`}>
                {lead.score}
                <span className="text-xs opacity-80">/10</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <SheetTitle className="text-primary-foreground text-xl flex items-center gap-1.5">
                  {hot && <Flame size={16} className="text-amber-300" />}
                  {lead.owner}
                </SheetTitle>
                <p className="text-sm opacity-80 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {lead.address}, {lead.city} {lead.state}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${filingColor(lead.filingType)}`}>
                {lead.filingType ?? t('inventoryDrawer.unknown')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(lead.status)}`}>
                {lead.status}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-foreground/20">
                {lead.leadType ?? t('inventoryDrawer.homeowner')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${lead.language === 'ES' ? 'bg-amber-300/30' : 'bg-primary-foreground/20'}`}>
                {lead.language === 'ES' ? t('inventoryDrawer.espanol') : t('inventoryDrawer.english')}
              </span>
              {lead.daysToAuction < 30 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive text-destructive-foreground">
                  <AlertTriangle size={10} /> {t('inventoryDrawer.auctionIn', { days: lead.daysToAuction })}
                </span>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          <Section title={t('inventoryDrawer.sections.contact')}>
            <CopyRow label={t('inventory.columns.phone')} value={lead.phone ?? null} icon={<Phone size={12} />} t={t} />
            <CopyRow label={t('inventory.columns.email')} value={lead.email ?? null} icon={<Mail size={12} />} t={t} />
          </Section>

          <Section title={t('inventoryDrawer.sections.qualification')}>
            <Info label={t('inventory.columns.equityPct')} value={`${lead.equityPct}%`} tone={lead.equityPct <= 25 ? 'good' : 'bad'} />
            <Info label={t('inventory.columns.ltvPct')} value={lead.ltvPct != null ? `${lead.ltvPct}%` : '—'} />
            <Info label={t('inventory.columns.daysToAuction')} value={`${lead.daysToAuction}d`} tone={lead.daysToAuction < 30 ? 'bad' : undefined} />
            <Info label={t('inventory.columns.filingType')} value={lead.filingType ?? '—'} />
            <Info label={t('inventory.columns.batchList')} value={lead.batchListName ?? '—'} />
          </Section>

          <Section title={t('inventoryDrawer.sections.assignmentActivity')}>
            <Info label={t('inventory.columns.assignedRep')} value={assignedName ?? t('inventory.empty.unassigned')} tone={assignedName ? undefined : 'warn'} />
            <Info label={t('inventory.columns.status')} value={lead.status} />
            <Info label={t('inventory.columns.contactAttempts')} value={String(lead.contactAttempts ?? 0)} />
            <Info label={t('inventory.columns.lastContact')} value={lead.lastContactDate ? formatRelative(lead.lastContactDate, t) : t('inventoryDrawer.never')} />
            <Info label={t('inventory.columns.lastOutcome')} value={lead.lastOutcome ?? '—'} />
            <Info label={t('inventory.columns.dateAdded')} value={formatRelative(lead.ingestedAt ?? lead.receivedAt, t)} />
          </Section>

          <Section title={t('inventoryDrawer.sections.propertyIdentifiers')}>
            <Info label={t('inventory.columns.apn')} value={lead.apn ?? '—'} />
            <Info label={t('inventory.columns.county')} value={lead.county || '—'} />
            <Info label="External ID" value={lead.externalId ?? '—'} />
          </Section>

          <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-card border-t flex flex-wrap gap-2">
            <InventoryRepPicker
              inDrawer
              allowUnassign={!!lead.assignedRepId}
              onPick={(repId) => onAssignRep(lead, repId)}
              trigger={
                <button
                  type="button"
                  className="flex-1 min-w-[120px] py-2 bg-muted text-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm hover:bg-muted/80"
                >
                  <UserPlus size={14} /> {assignedName ? t('inventoryDrawer.reassign') : t('inventory.buttons.assignRep')}
                </button>
              }
            />
            <button
              onClick={() => onStatusChange(lead, 'Promoted')}
              className="flex-1 min-w-[120px] py-2 bg-accent text-accent-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <ArrowRightCircle size={14} /> {t('inventory.buttons.promote')}
            </button>
            <button
              onClick={() => onStatusChange(lead, 'Dismissed')}
              className="flex-1 min-w-[120px] py-2 bg-destructive text-destructive-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <EyeOff size={14} /> {t('inventory.buttons.dismiss')}
            </button>
            <button
              onClick={() => onPushToMojo(lead)}
              className="flex-1 min-w-[120px] py-2 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <ArrowUpToLine size={14} /> {t('inventory.buttons.pushToMojo')}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  const color =
    tone === 'good' ? 'text-emerald-600' :
    tone === 'bad' ? 'text-destructive' :
    tone === 'warn' ? 'text-amber-600' : 'text-foreground';
  return (
    <div className="flex justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-right ${color}`}>{value}</span>
    </div>
  );
}

function CopyRow({ label, value, icon, t }: { label: string; value: string | null; icon: React.ReactNode; t: (key: string, opts?: Record<string, unknown>) => string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-foreground">{value ?? '—'}</span>
        {value && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(value).then(() => toast.success(t('inventory.toasts.copied', { label })));
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title={t('inventoryDrawer.copyTitle', { label })}
          >
            <Copy size={12} />
          </button>
        )}
      </span>
    </div>
  );
}

// Exported helper so the table can reuse the same color logic.
export { scoreColor, filingColor, statusColor, formatRelative };
