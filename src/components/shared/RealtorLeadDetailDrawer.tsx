import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowUpToLine, Building2, Calendar, Copy, ExternalLink,
  Flame, Globe, Loader2, Mail, MapPin, MessageSquare, Phone, UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { sendToMojo } from '@/integrations/mojoDialer';
import type { RealtorAgent, RealtorLeadStatus } from '@/services/realtor';

const STATUSES: RealtorLeadStatus[] = ['New', 'Contacted', 'Partnered', 'Closed Won', 'Declined'];

const STATUS_COLOR: Record<RealtorLeadStatus, string> = {
  'New':         'bg-primary/10 text-primary border border-primary/30',
  'Contacted':   'bg-amber-100 text-amber-700 border border-amber-300',
  'Partnered':   'bg-accent/10 text-accent border border-accent/30',
  'Closed Won':  'bg-emerald-100 text-emerald-700 border border-emerald-300',
  'Declined':    'bg-muted text-muted-foreground border',
};

function zillowUrl(address: string, city: string, state: string): string {
  const slug = `${address} ${city} ${state}`
    .replace(/[,#]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}/`;
}

interface Props {
  agent: RealtorAgent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedRep?: string;
  reps?: string[];
  onStatusChange?: (agent: RealtorAgent, status: RealtorLeadStatus) => void | Promise<void>;
  onAssignRep?: (agent: RealtorAgent, rep: string) => void;
}

export default function RealtorLeadDetailDrawer({
  agent,
  open,
  onOpenChange,
  assignedRep,
  reps = [],
  onStatusChange,
  onAssignRep,
}: Props) {
  const { i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';
  const [mojoPushing, setMojoPushing] = useState(false);
  const [localRep, setLocalRep] = useState(agent.assignedRep ?? assignedRep ?? 'Unassigned');
  const [localStatus, setLocalStatus] = useState<RealtorLeadStatus>(agent.status);

  // Sync localRep/localStatus when the agent changes (in case the drawer is reused without remount)
  useEffect(() => { setLocalRep(agent.assignedRep ?? assignedRep ?? 'Unassigned'); }, [agent.id]);
  useEffect(() => { setLocalStatus(agent.status); }, [agent.id]);

  const hot = agent.latestDaysOnMarket >= 30 || agent.listingCount >= 2;
  const listingUrl = agent.latestPropertyAddress
    ? zillowUrl(agent.latestPropertyAddress, agent.latestCity, agent.latestState)
    : '';
  const price = agent.latestListPrice
    ? `$${agent.latestListPrice.toLocaleString(loc)}`
    : '—';

  const handlePushToMojo = async () => {
    setMojoPushing(true);
    try {
      const result = await sendToMojo([agent]);
      if (result.ok) {
        toast.success(`Sent ${agent.agentName} to Mojo`);
      } else {
        toast.error(`Push failed: ${result.errors[0] ?? 'Unknown error'}`);
      }
    } catch (e) {
      toast.error(`Push failed: ${(e as Error).message}`);
    } finally {
      setMojoPushing(false);
    }
  };

  const handleStatusChange = async (status: RealtorLeadStatus) => {
    setLocalStatus(status);
    await onStatusChange?.(agent, status);
  };

  const handleAssignRep = (rep: string) => {
    setLocalRep(rep);
    onAssignRep?.(agent, rep);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                  <Building2 size={12} />{' '}
                  {agent.datasetId === 'zillow-apify' ? 'Realtor Lead · Zillow' : 'Realtor Lead · Bridge MLS'}
                </div>
                <SheetTitle className="text-primary-foreground text-xl flex items-center gap-2">
                  {hot && <Flame size={16} className="text-amber-300 shrink-0" />}
                  {agent.agentName}
                </SheetTitle>
                <p className="text-sm opacity-80 mt-0.5">{agent.brokerage}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[localStatus]}`}>
                {localStatus}
              </span>
              {agent.language === 'ES' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-300/30 flex items-center gap-1">
                  <Globe size={10} /> Spanish preferred
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-foreground/20">
                {agent.datasetId === 'zillow-apify' ? 'ZPID' : 'MLS#'} {agent.latestListingId || '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-foreground/20">
                {agent.datasetId}
              </span>
            </div>
          </SheetHeader>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <a
              href={`tel:${agent.agentPhone}`}
              className="flex flex-col items-center gap-1 py-3 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30"
            >
              <Phone size={16} />
              <span className="text-xs font-bold">Call</span>
            </a>
            <a
              href={`mailto:${agent.agentEmail}`}
              className="flex flex-col items-center gap-1 py-3 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30"
            >
              <Mail size={16} />
              <span className="text-xs font-bold">Email</span>
            </a>
            <a
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-3 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30"
            >
              <ExternalLink size={16} />
              <span className="text-xs font-bold">Listing</span>
            </a>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Contact */}
          <Section title="Contact">
            <CopyRow
              icon={<Phone size={12} />}
              label="Phone"
              value={agent.agentPhone || null}
              onCopy={copyToClipboard}
            />
            <CopyRow
              icon={<Mail size={12} />}
              label="Email"
              value={agent.agentEmail || null}
              onCopy={copyToClipboard}
            />
          </Section>

          {/* Property */}
          <Section title="Property">
            <InfoRow
              icon={<MapPin size={12} />}
              label="Address"
              value={`${agent.latestPropertyAddress}, ${agent.latestCity}, ${agent.latestState}`}
            />
            <InfoRow label="List price" value={price} />
            <InfoRow
              icon={<Calendar size={12} />}
              label="Days on market"
              value={`${agent.latestDaysOnMarket}d`}
              tone={agent.latestDaysOnMarket >= 90 ? 'bad' : undefined}
            />
            {agent.listingCount > 1 && (
              <InfoRow label="Listings" value={String(agent.listingCount)} tone="warn" />
            )}
          </Section>

          {/* Assignment & Activity */}
          <Section title="Assignment & Activity">
            {reps.length > 0 && onAssignRep ? (
              <div className="flex justify-between items-center text-sm py-1.5 border-b">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UserCheck size={12} /> Assigned rep
                </span>
                <select
                  value={localRep}
                  onChange={(e) => handleAssignRep(e.target.value)}
                  className="text-sm font-medium bg-muted rounded px-2 py-1 border-0 outline-none max-w-[55%]"
                >
                  {reps.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ) : (
              <InfoRow label="Assigned rep" value={localRep || 'Unassigned'} tone={localRep && localRep !== 'Unassigned' ? undefined : 'warn'} />
            )}
            <InfoRow label="Status" value={localStatus} />
            <InfoRow label="Last contact" value={agent.lastContactAt ?? 'Not yet contacted'} />
          </Section>

          {/* Status picker */}
          <Section title="Change Status">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    localStatus === s
                      ? STATUS_COLOR[s] + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Section>

          {/* Suggested opener */}
          <div className="rounded-lg border-l-4 border-l-secondary bg-secondary/5 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-secondary mb-1">
              <MessageSquare size={12} /> Suggested opener
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              "Hi {agent.agentName?.split(' ')[0] ?? 'there'}, I noticed your short sale listing at {agent.latestPropertyAddress}. We process short sales at no cost to the listing agent — you keep your full commission. Got 90 seconds?"
            </p>
          </div>

          {agent.latestPublicRemarks && (
            <Section title="Listing Remarks">
              <p className="text-sm text-foreground bg-muted/50 rounded p-2">{agent.latestPublicRemarks}</p>
            </Section>
          )}
        </div>

        {/* Sticky footer action bar */}
        <div className="sticky bottom-0 bg-card border-t p-4 flex flex-wrap gap-2">
          {reps.length > 0 && (
            <div className="flex-1 min-w-[120px]">
              <select
                value={localRep}
                onChange={(e) => handleAssignRep(e.target.value)}
                className="w-full py-2 px-3 bg-muted text-foreground rounded-lg font-semibold text-sm border-0 outline-none"
              >
                <option value="Unassigned">Unassigned</option>
                {reps.filter(r => r !== 'Unassigned').map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handlePushToMojo}
            disabled={mojoPushing}
            className="flex-1 min-w-[120px] py-2 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            {mojoPushing ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpToLine size={14} />}
            Push to Mojo
          </button>
          {agent.agentPhone && (
            <a
              href={`tel:${agent.agentPhone}`}
              className="flex-1 min-w-[120px] py-2 bg-accent text-accent-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm hover:opacity-90"
            >
              <Phone size={14} /> Call
            </a>
          )}
          {agent.agentEmail && (
            <a
              href={`mailto:${agent.agentEmail}`}
              className="flex-1 min-w-[120px] py-2 bg-secondary text-secondary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm hover:opacity-90"
            >
              <Mail size={14} /> Email
            </a>
          )}
          {listingUrl && (
            <a
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[120px] py-2 bg-muted text-foreground rounded-lg font-semibold flex items-center justify-center gap-2 text-sm hover:bg-muted/70"
            >
              <ExternalLink size={14} /> Listing
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function InfoRow({
  icon, label, value, tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: 'bad' | 'warn' | 'good';
}) {
  const color =
    tone === 'bad'  ? 'text-destructive' :
    tone === 'warn' ? 'text-amber-600' :
    tone === 'good' ? 'text-emerald-600' : 'text-foreground';
  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className={`font-medium text-right truncate max-w-[60%] ${color}`}>{value}</span>
    </div>
  );
}

function CopyRow({
  icon, label, value, onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  onCopy: (v: string, l: string) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-foreground">{value || '—'}</span>
        {value && (
          <button
            type="button"
            onClick={() => onCopy(value, label)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title={`Copy ${label}`}
          >
            <Copy size={12} />
          </button>
        )}
      </span>
    </div>
  );
}
