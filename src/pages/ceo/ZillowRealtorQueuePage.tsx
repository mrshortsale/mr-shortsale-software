import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Filter, ArrowUpDown, Phone, Flame, Building2, Users, RefreshCw,
  Loader2, Send, Mail, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from '@/services/auth';
import {
  fetchZillowLeads,
  patchZillowLead,
  roundRobinAssignZillowLeads,
  type ZillowAgentLead,
  type ZillowStats,
  type ZillowLeadStatus,
} from '@/services/zillowApify';
import { fetchRealtorReps } from '@/services/realtor';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'days' | 'price' | 'count' | 'newest';

// ─── Mojo push (maps Zillow lead → mojo-push AgentPayload) ───────────────────

async function sendZillowToMojo(leads: ZillowAgentLead[]) {
  const token = getStoredToken();
  const agents = leads.map((l) => ({
    id: l.id,
    agentName: l.agentName,
    brokerage: l.brokerage,
    agentPhone: l.agentPhone,
    agentEmail: l.agentEmail,
    latestPropertyAddress: l.latestPropertyAddress ?? '',
    latestCity: l.latestCity ?? '',
    latestState: l.latestState ?? '',
    latestListingId: l.latestZpid ?? '',
    latestListPrice: l.latestListPrice ?? 0,
    latestDaysOnMarket: l.latestDaysOnMarket ?? 0,
    latestPublicRemarks: l.trueStatus ?? '',
    datasetId: 'zillow-apify',
    status: l.status,
    language: 'EN',
  }));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/mojo-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { 'x-auth-token': token } : {}),
    },
    body: JSON.stringify({ agents }),
  });
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ZillowLeadStatus, string> = {
  'New':        'bg-primary/10 text-primary',
  'Contacted':  'bg-amber-100 text-amber-700',
  'Partnered':  'bg-accent/10 text-accent',
  'Closed Won': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Declined':   'bg-muted text-muted-foreground',
};

function fmtPrice(p: number | null) {
  if (p == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p);
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  const color = accent === 'amber' ? 'text-amber-500' : accent === 'accent' ? 'text-accent' : accent === 'secondary' ? 'text-secondary' : 'text-muted-foreground';
  return (
    <div className="metric-card flex items-center gap-3 p-3">
      <span className={`${color} shrink-0`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-bold leading-tight">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

interface DrawerProps {
  lead: ZillowAgentLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: string[];
  onStatusChange: (lead: ZillowAgentLead, status: ZillowLeadStatus) => void;
  onAssignRep: (lead: ZillowAgentLead, rep: string) => void;
}

function ZillowLeadDrawer({ lead, open, onOpenChange, reps, onStatusChange, onAssignRep }: DrawerProps) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState<ZillowLeadStatus>(lead.status);
  const [localRep, setLocalRep] = useState(lead.assignedRep ?? 'Unassigned');
  const [mojoPushing, setMojoPushing] = useState(false);

  useEffect(() => {
    setNotes(lead.notes ?? '');
    setLocalStatus(lead.status);
    setLocalRep(lead.assignedRep ?? 'Unassigned');
  }, [lead.id]);

  if (!open) return null;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await patchZillowLead({ id: lead.id, notes });
    setSaving(false);
    if (error) toast.error(error); else toast.success('Notes saved');
  };

  const handleStatus = async (s: ZillowLeadStatus) => {
    setLocalStatus(s);
    const { error } = await patchZillowLead({ id: lead.id, status: s });
    if (error) { toast.error(error); setLocalStatus(lead.status); }
    else onStatusChange(lead, s);
  };

  const handleRep = async (rep: string) => {
    const repVal = rep === 'Unassigned' ? null : rep;
    setLocalRep(rep);
    const { error } = await patchZillowLead({ id: lead.id, assignedRep: repVal });
    if (error) { toast.error(error); setLocalRep(lead.assignedRep ?? 'Unassigned'); }
    else onAssignRep(lead, rep);
  };

  const handleMojo = async () => {
    setMojoPushing(true);
    try {
      const res = await sendZillowToMojo([lead]);
      if (res.ok) toast.success('Sent to Mojo Dialer');
      else toast.error(res.errors?.[0] ?? 'Push failed');
    } catch { toast.error('Push failed'); }
    setMojoPushing(false);
  };

  const STATUSES: ZillowLeadStatus[] = ['New', 'Contacted', 'Partnered', 'Closed Won', 'Declined'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={() => onOpenChange(false)}>
      <div
        className="h-full w-full max-w-md bg-card border-l shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{lead.agentName || 'Unknown Agent'}</h2>
              <p className="text-sm text-muted-foreground">{lead.brokerage}</p>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            {lead.agentPhone && (
              <button type="button" onClick={() => copy(lead.agentPhone)} className="flex items-center gap-2 text-sm hover:text-primary">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {lead.agentPhone}
              </button>
            )}
            {lead.agentEmail && (
              <button type="button" onClick={() => copy(lead.agentEmail)} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {lead.agentEmail}
              </button>
            )}
            {lead.brokerPhone && (
              <button type="button" onClick={() => copy(lead.brokerPhone)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="h-3.5 w-3.5" />
                {lead.brokerPhone} (broker)
              </button>
            )}
          </div>

          {/* Latest listing */}
          <div className="rounded-md bg-muted/40 p-3 space-y-1 text-sm">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Latest Listing</p>
            {lead.latestPropertyAddress && <p>{lead.latestPropertyAddress}, {lead.latestCity}, {lead.latestState}</p>}
            <div className="flex gap-4 text-xs text-muted-foreground">
              {lead.latestListPrice && <span>{fmtPrice(lead.latestListPrice)}</span>}
              {lead.latestDaysOnMarket != null && <span>{lead.latestDaysOnMarket} DOM</span>}
              {lead.mlsName && <span>{lead.mlsName}</span>}
              <span>{lead.listingCount} listing{lead.listingCount !== 1 ? 's' : ''}</span>
            </div>
            {lead.latestDetailUrl && (
              <a
                href={lead.latestDetailUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View on Zillow <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${localStatus === s ? STATUS_BADGE[s] + ' border-current' : 'border-border hover:bg-muted'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Rep assignment */}
          {reps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned Rep</p>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                value={localRep}
                onChange={(e) => handleRep(e.target.value)}
              >
                <option value="Unassigned">Unassigned</option>
                {reps.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
            <textarea
              className="w-full border rounded-md px-2 py-1.5 text-sm bg-background resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save Notes
            </Button>
          </div>

          {/* Mojo push */}
          <Button size="sm" className="w-full" onClick={handleMojo} disabled={mojoPushing}>
            {mojoPushing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            Push to Mojo Dialer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ZillowRealtorQueuePage() {
  const [leads, setLeads] = useState<ZillowAgentLead[]>([]);
  const [stats, setStats] = useState<ZillowStats>({
    total: 0, newToday: 0, hotLeads: 0, awaitingFollowup: 0, lastSyncAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [totalMatching, setTotalMatching] = useState(0);
  const [drawerLead, setDrawerLead] = useState<ZillowAgentLead | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [filterState, setFilterState] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ZillowLeadStatus>('all');
  const [filterRep, setFilterRep] = useState('all');
  const [hotOnly, setHotOnly] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [repNames, setRepNames] = useState<string[]>([]);
  const [roundRobinAssigning, setRoundRobinAssigning] = useState(false);
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [bulkRep, setBulkRep] = useState('');
  const [mojoPushing, setMojoPushing] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchRealtorReps().then(({ reps }) => {
      const names = reps.map((r) => r.name).filter(Boolean);
      setRepNames(names);
      if (names.length > 0) setBulkRep((prev) => prev || names[0]);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { leads: l, total, stats: s, error } = await fetchZillowLeads({
      statuses: filterStatus === 'all' ? undefined : [filterStatus],
      state: filterState === 'all' ? undefined : filterState,
      hotOnly,
      assignedRep: filterRep === 'all' ? undefined : filterRep === 'unassigned' ? 'unassigned' : filterRep,
      q: searchQ || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    setLoading(false);
    if (error) { toast.error(error); return; }
    setLeads(l);
    setStats(s);
    setTotalMatching(total);
  }, [filterStatus, filterState, hotOnly, filterRep, searchQ, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  const sorted = useMemo(() => {
    const l = [...leads];
    if (sortKey === 'days') l.sort((a, b) => (b.latestDaysOnMarket ?? 0) - (a.latestDaysOnMarket ?? 0));
    else if (sortKey === 'price') l.sort((a, b) => (b.latestListPrice ?? 0) - (a.latestListPrice ?? 0));
    else if (sortKey === 'count') l.sort((a, b) => b.listingCount - a.listingCount);
    else l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return l;
  }, [leads, sortKey]);

  const handleRoundRobin = async () => {
    setRoundRobinAssigning(true);
    const { assigned, repCount, error } = await roundRobinAssignZillowLeads();
    setRoundRobinAssigning(false);
    if (error) { toast.error(error); return; }
    toast.success(`Assigned ${assigned} lead${assigned !== 1 ? 's' : ''} across ${repCount} rep${repCount !== 1 ? 's' : ''}`);
    load();
  };

  const handleStatusChange = (lead: ZillowAgentLead, status: ZillowLeadStatus) => {
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status } : l));
    if (drawerLead?.id === lead.id) setDrawerLead((prev) => prev ? { ...prev, status } : null);
  };

  const handleAssignRep = (lead: ZillowAgentLead, rep: string) => {
    const repVal = rep === 'Unassigned' ? null : rep;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, assignedRep: repVal } : l));
    if (drawerLead?.id === lead.id) setDrawerLead((prev) => prev ? { ...prev, assignedRep: repVal } : null);
  };

  const applyBulkAssign = async () => {
    const targets = sorted.filter((l) => bulk.has(l.id));
    for (const lead of targets) {
      await patchZillowLead({ id: lead.id, assignedRep: bulkRep === 'Unassigned' ? null : bulkRep });
      handleAssignRep(lead, bulkRep);
    }
    setBulk(new Set());
    toast.success(`Assigned ${targets.length} leads`);
  };

  const pushBulkToMojo = async () => {
    const targets = sorted.filter((l) => bulk.has(l.id));
    const ids = new Set(targets.map((l) => l.id));
    setMojoPushing((p) => new Set([...p, ...ids]));
    try {
      const res = await sendZillowToMojo(targets);
      if (res.ok) toast.success(`Sent ${res.sent} to Mojo`);
      else toast.error(res.errors?.[0] ?? 'Push failed');
    } catch { toast.error('Push failed'); }
    setMojoPushing((p) => { const n = new Set(p); ids.forEach((id) => n.delete(id)); return n; });
    setBulk(new Set());
  };

  const isHot = (l: ZillowAgentLead) => (l.latestDaysOnMarket ?? 0) >= 30 || l.listingCount >= 2;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Building2 size={14} />} label="Total Leads" value={stats.total} />
        <Stat icon={<Flame size={14} />} label="New Today" value={stats.newToday} accent="secondary" />
        <Stat icon={<Phone size={14} />} label="Awaiting Follow-up" value={stats.awaitingFollowup} accent="amber" />
        <Stat icon={<Users size={14} />} label="Hot Agents" value={stats.hotLeads} accent="accent" />
      </div>

      {/* Filter + action bar */}
      <div className="metric-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <Input
            className="h-7 text-xs w-36"
            placeholder="Search..."
            value={searchQ}
            onChange={(e) => { setPage(1); setSearchQ(e.target.value); }}
          />
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={filterState}
            onChange={(e) => { setPage(1); setFilterState(e.target.value); }}
          >
            <option value="all">All States</option>
            <option value="FL">Florida</option>
            <option value="NY">New York</option>
            <option value="CA">California</option>
            <option value="TX">Texas</option>
          </select>
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={filterStatus}
            onChange={(e) => { setPage(1); setFilterStatus(e.target.value as 'all' | ZillowLeadStatus); }}
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Partnered">Partnered</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Declined">Declined</option>
          </select>
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={filterRep}
            onChange={(e) => { setPage(1); setFilterRep(e.target.value); }}
          >
            <option value="all">All Reps</option>
            <option value="unassigned">Unassigned</option>
            {repNames.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="button"
            onClick={() => { setPage(1); setHotOnly((v) => !v); }}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${hotOnly ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            <Flame size={11} /> Hot Only
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs ml-auto">
          <button
            type="button"
            onClick={handleRoundRobin}
            disabled={roundRobinAssigning || repNames.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary text-secondary-foreground text-[11px] font-bold hover:opacity-90 disabled:opacity-50"
          >
            {roundRobinAssigning ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
            Round-robin assign all
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1 rounded hover:bg-muted"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <ArrowUpDown size={14} className="text-muted-foreground" />
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="days">Days on Market ↓</option>
            <option value="newest">Newest First</option>
            <option value="price">Price ↓</option>
            <option value="count">Listings ↓</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulk.size > 0 && (
        <div className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 text-sm">
          <span className="font-semibold">{bulk.size} selected</span>
          <select
            className="bg-primary-foreground/20 rounded px-2 py-0.5 text-xs border-0 text-primary-foreground"
            value={bulkRep}
            onChange={(e) => setBulkRep(e.target.value)}
          >
            <option value="Unassigned">Unassigned</option>
            {repNames.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="button"
            onClick={applyBulkAssign}
            className="text-xs font-semibold px-2 py-0.5 rounded bg-white/20 hover:bg-white/30"
          >
            Assign
          </button>
          <button
            type="button"
            onClick={pushBulkToMojo}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-white/20 hover:bg-white/30"
          >
            <Send size={11} /> Mojo
          </button>
          <button type="button" onClick={() => setBulk(new Set())} className="ml-auto text-xs opacity-70 hover:opacity-100">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="metric-card text-center py-10 text-muted-foreground text-sm">
          No Zillow agent leads found. Run a sync from{' '}
          <Link to="/ceo/zillow-apify-sync" className="underline underline-offset-2">Zillow Apify Sync</Link>{' '}
          to populate this queue.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 w-8">
                  <input
                    type="checkbox"
                    checked={bulk.size === sorted.length && sorted.length > 0}
                    onChange={(e) => setBulk(e.target.checked ? new Set(sorted.map((l) => l.id)) : new Set())}
                    className="rounded"
                  />
                </th>
                <th className="py-2 pr-3 text-left font-medium">Agent / Brokerage</th>
                <th className="py-2 pr-3 text-left font-medium">Contact</th>
                <th className="py-2 pr-3 text-left font-medium">Latest Listing</th>
                <th className="py-2 pr-3 text-right font-medium">DOM</th>
                <th className="py-2 pr-3 text-right font-medium">Price</th>
                <th className="py-2 pr-3 text-left font-medium">Status</th>
                <th className="py-2 pr-3 text-left font-medium">Rep</th>
                <th className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setDrawerLead(lead)}
                >
                  <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={bulk.has(lead.id)}
                      onChange={(e) => {
                        const next = new Set(bulk);
                        if (e.target.checked) next.add(lead.id); else next.delete(lead.id);
                        setBulk(next);
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      {isHot(lead) && <Flame size={12} className="text-amber-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[160px]">{lead.agentName || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{lead.brokerage || '—'}</p>
                        {lead.mlsName && <p className="text-[10px] text-muted-foreground">{lead.mlsName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <p className="text-xs font-mono">{lead.agentPhone || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">{lead.agentEmail || ''}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="text-xs">
                      {lead.latestPropertyAddress
                        ? <p className="truncate max-w-[160px]">{lead.latestPropertyAddress}</p>
                        : <span className="text-muted-foreground">—</span>}
                      {lead.latestCity && (
                        <p className="text-muted-foreground">{lead.latestCity}, {lead.latestState}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {lead.latestDaysOnMarket != null ? (
                      <span className={lead.latestDaysOnMarket >= 30 ? 'text-amber-600 font-semibold' : ''}>
                        {lead.latestDaysOnMarket}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-xs">{fmtPrice(lead.latestListPrice)}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[lead.status]}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {lead.assignedRep ?? <span className="text-muted-foreground italic">Unassigned</span>}
                  </td>
                  <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        const pushing = new Set(mojoPushing).add(lead.id);
                        setMojoPushing(pushing);
                        sendZillowToMojo([lead])
                          .then((r) => { if (r.ok) toast.success('Sent to Mojo'); else toast.error(r.errors?.[0] ?? 'Push failed'); })
                          .catch(() => toast.error('Push failed'))
                          .finally(() => setMojoPushing((p) => { const n = new Set(p); n.delete(lead.id); return n; }));
                      }}
                      disabled={mojoPushing.has(lead.id)}
                      className="p-1 rounded hover:bg-muted disabled:opacity-50"
                      title="Push to Mojo Dialer"
                    >
                      {mojoPushing.has(lead.id) ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span>Page {page} of {totalPages} ({totalMatching.toLocaleString()} total)</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1 rounded hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Drawer */}
      {drawerLead && (
        <ZillowLeadDrawer
          lead={drawerLead}
          open={!!drawerLead}
          onOpenChange={(open) => { if (!open) setDrawerLead(null); }}
          reps={repNames}
          onStatusChange={handleStatusChange}
          onAssignRep={handleAssignRep}
        />
      )}
    </div>
  );
}
