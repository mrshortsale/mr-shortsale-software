import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, Play, Pause, Square, RefreshCw, Loader2,
  ChevronDown, ChevronUp, ExternalLink, Globe, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  listZillowProfiles,
  createZillowProfile,
  updateZillowProfile,
  deleteZillowProfile,
  fetchZillowSyncStatus,
  startZillowSync,
  pauseZillowSync,
  stopZillowSync,
  listZillowSyncRuns,
  collectZillowAgents,
  type ZillowSyncProfile,
  type ZillowSyncRun,
  type SearchConfig,
} from '@/services/zillowApify';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    paused: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    stopped: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Profile form ─────────────────────────────────────────────────────────────

interface ProfileFormState {
  displayName: string;
  urlMode: 'builder' | 'paste';
  rawUrl: string;
  // builder fields
  state: string;
  listingType: 'forSale' | 'forRent' | 'sold';
  shortSaleOnly: boolean;
  foreclosureOnly: boolean;
  daysOnZillow: string;
  priceMin: string;
  priceMax: string;
  enabled: boolean;
}

const DEFAULT_FORM: ProfileFormState = {
  displayName: '',
  urlMode: 'paste',
  rawUrl: '',
  state: 'fl',
  listingType: 'forSale',
  shortSaleOnly: true,
  foreclosureOnly: false,
  daysOnZillow: '',
  priceMin: '',
  priceMax: '',
  enabled: false,
};

function formToSearchConfig(form: ProfileFormState): SearchConfig {
  if (form.urlMode === 'paste') return { rawUrl: form.rawUrl };
  return {
    state: form.state || 'fl',
    listingType: form.listingType,
    shortSaleOnly: form.shortSaleOnly,
    foreclosureOnly: form.foreclosureOnly,
    daysOnZillow: form.daysOnZillow ? Number(form.daysOnZillow) : undefined,
    priceMin: form.priceMin ? Number(form.priceMin) : undefined,
    priceMax: form.priceMax ? Number(form.priceMax) : undefined,
  };
}

interface ProfileFormProps {
  initial?: ProfileFormState;
  onSave: (form: ProfileFormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ProfileForm({ initial, onSave, onCancel, saving }: ProfileFormProps) {
  const [form, setForm] = useState<ProfileFormState>(initial ?? DEFAULT_FORM);
  const set = (patch: Partial<ProfileFormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) { toast.error('Display name is required'); return; }
    if (form.urlMode === 'paste' && !form.rawUrl.trim()) { toast.error('Paste a Zillow search URL'); return; }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Display Name</Label>
        <Input
          placeholder="FL Short Sale Q3 2026"
          value={form.displayName}
          onChange={(e) => set({ displayName: e.target.value })}
        />
      </div>

      {/* URL input tabs */}
      <div className="space-y-2">
        <Label>Search URL</Label>
        <div className="flex rounded-md border overflow-hidden text-xs font-medium">
          <button
            type="button"
            onClick={() => set({ urlMode: 'builder' })}
            className={`flex-1 py-1.5 ${form.urlMode === 'builder' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            Builder
          </button>
          <button
            type="button"
            onClick={() => set({ urlMode: 'paste' })}
            className={`flex-1 py-1.5 ${form.urlMode === 'paste' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            Paste URL
          </button>
        </div>

        {form.urlMode === 'paste' ? (
          <div className="space-y-1">
            <Input
              placeholder="https://www.zillow.com/fl/?searchQueryState=..."
              value={form.rawUrl}
              onChange={(e) => set({ rawUrl: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">Paste a Zillow search results URL directly from your browser.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">State (abbreviation)</Label>
              <Input
                placeholder="fl"
                value={form.state}
                onChange={(e) => set({ state: e.target.value.toLowerCase() })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Listing Type</Label>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                value={form.listingType}
                onChange={(e) => set({ listingType: e.target.value as ProfileFormState['listingType'] })}
              >
                <option value="forSale">For Sale</option>
                <option value="forRent">For Rent</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Days on Zillow</Label>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                value={form.daysOnZillow}
                onChange={(e) => set({ daysOnZillow: e.target.value })}
              >
                <option value="">Any</option>
                {[1, 3, 7, 14, 30, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Price</Label>
              <Input
                placeholder="e.g. 200000"
                value={form.priceMin}
                onChange={(e) => set({ priceMin: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.shortSaleOnly}
                  onChange={(e) => set({ shortSaleOnly: e.target.checked })}
                  className="rounded"
                />
                Short Sale Only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.foreclosureOnly}
                  onChange={(e) => set({ foreclosureOnly: e.target.checked })}
                  className="rounded"
                />
                Foreclosure Only
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
          <span>Enabled</span>
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save Profile
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Run history table ────────────────────────────────────────────────────────

function RunHistory({ profileId }: { profileId: string }) {
  const [runs, setRuns] = useState<ZillowSyncRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listZillowSyncRuns(profileId).then(({ runs: r }) => {
      setRuns(r);
      setLoading(false);
    });
  }, [profileId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (runs.length === 0) return <p className="text-xs text-muted-foreground">No sync runs yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1.5 pr-3 text-left font-medium">Status</th>
            <th className="py-1.5 pr-3 text-left font-medium">Started</th>
            <th className="py-1.5 pr-3 text-right font-medium">Listings</th>
            <th className="py-1.5 pr-3 text-right font-medium">Agents</th>
            <th className="py-1.5 text-left font-medium">Completed</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-1.5 pr-3">{statusBadge(r.status)}</td>
              <td className="py-1.5 pr-3 text-muted-foreground">{fmtDate(r.started_at)}</td>
              <td className="py-1.5 pr-3 text-right">{r.listings_scraped}</td>
              <td className="py-1.5 pr-3 text-right">{r.agents_upserted}</td>
              <td className="py-1.5 text-muted-foreground">{fmtDate(r.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

interface ProfileCardProps {
  profile: ZillowSyncProfile;
  activeRun: ZillowSyncRun | null;
  onRefresh: () => void;
  onUpdate: (p: ZillowSyncProfile) => void;
  onDelete: (id: string) => void;
}

function ProfileCard({ profile, activeRun, onRefresh, onUpdate, onDelete }: ProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    const { runId, error } = await startZillowSync(profile.id);
    setSyncing(false);
    if (error) { toast.error(error); return; }
    toast.success(`Sync started (run ${runId?.slice(0, 8)}…)`);
    onRefresh();
  };

  const handlePause = async () => {
    if (!activeRun) return;
    const { error } = await pauseZillowSync(activeRun.id);
    if (error) toast.error(error);
    else { toast.info('Sync paused'); onRefresh(); }
  };

  const handleStop = async () => {
    if (!activeRun) return;
    const { error } = await stopZillowSync(activeRun.id);
    if (error) toast.error(error);
    else { toast.info('Sync stopped'); onRefresh(); }
  };

  const handleCollect = async () => {
    if (!activeRun) return;
    const { processed, stillPending, done, error } = await collectZillowAgents(activeRun.id);
    if (error) toast.error(error);
    else {
      if (done) toast.success('All agent runs collected — sync complete!');
      else toast.info(`Collected ${processed} agents, ${stillPending} batch(es) still running…`);
    }
    onRefresh();
  };

  const handleToggleEnabled = async () => {
    const { profile: updated, error } = await updateZillowProfile({
      profileId: profile.id,
      enabled: !profile.enabled,
    });
    if (error) toast.error(error);
    else if (updated) onUpdate(updated);
  };

  const handleSaveEdit = async (form: ProfileFormState) => {
    setSavingEdit(true);
    const searchConfig = formToSearchConfig(form);
    const { profile: updated, error } = await updateZillowProfile({
      profileId: profile.id,
      displayName: form.displayName,
      searchConfig,
      enabled: form.enabled,
    });
    setSavingEdit(false);
    if (error) toast.error(error);
    else if (updated) {
      onUpdate(updated);
      setEditing(false);
      toast.success('Profile updated');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete profile "${profile.display_name}"? All associated sync runs will be removed.`)) return;
    const { error } = await deleteZillowProfile(profile.id);
    if (error) toast.error(error);
    else { toast.success('Profile deleted'); onDelete(profile.id); }
  };

  const isActive = activeRun && (activeRun.status === 'running' || activeRun.status === 'paused' || activeRun.status === 'partial');
  const cfg = (profile.search_config ?? {}) as {
    rawUrl?: string; state?: string; listingType?: string;
    shortSaleOnly?: boolean; foreclosureOnly?: boolean;
    daysOnZillow?: number; priceMin?: number; priceMax?: number;
  };
  const formInitial: ProfileFormState = {
    displayName: profile.display_name,
    urlMode: cfg.rawUrl ? 'paste' : 'builder',
    rawUrl: cfg.rawUrl ?? profile.search_url,
    state: cfg.state ?? 'fl',
    listingType: (cfg.listingType as ProfileFormState['listingType']) ?? 'forSale',
    shortSaleOnly: cfg.shortSaleOnly ?? true,
    foreclosureOnly: cfg.foreclosureOnly ?? false,
    daysOnZillow: String(cfg.daysOnZillow ?? ''),
    priceMin: String(cfg.priceMin ?? ''),
    priceMax: String(cfg.priceMax ?? ''),
    enabled: profile.enabled,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{profile.display_name}</h3>
              {profile.enabled ? (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Enabled</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Disabled</Badge>
              )}
              {activeRun && statusBadge(activeRun.status)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last sync: {fmtDate(profile.last_synced_at)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isActive ? (
              <>
                {activeRun!.status === 'partial' && (
                  <Button size="sm" variant="outline" onClick={handleCollect} title="Check if agent runs finished">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Check Progress
                  </Button>
                )}
                {activeRun!.status === 'running' && (
                  <Button size="sm" variant="outline" onClick={handlePause}>
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleStop}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Play className="h-3.5 w-3.5" />}
                Sync
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={handleToggleEnabled} title={profile.enabled ? 'Disable' : 'Enable'}>
              {profile.enabled ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {editing && (
        <CardContent className="border-t pt-4">
          <ProfileForm
            initial={formInitial}
            onSave={handleSaveEdit}
            onCancel={() => setEditing(false)}
            saving={savingEdit}
          />
        </CardContent>
      )}

      {/* Search URL preview + run history */}
      <CardContent className="pt-0">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Hide details' : 'Show URL & run history'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <a
                href={profile.search_url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono break-all text-primary hover:underline"
              >
                {(profile.search_url ?? '').length > 120
                  ? `${(profile.search_url ?? '').slice(0, 120)}…`
                  : (profile.search_url ?? '—')}
                <ExternalLink className="inline ml-1 h-3 w-3" />
              </a>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium mb-2">Run History</p>
              <RunHistory profileId={profile.id} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ZillowApifySyncPage() {
  const [profiles, setProfiles] = useState<ZillowSyncProfile[]>([]);
  const [recentRuns, setRecentRuns] = useState<ZillowSyncRun[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  const loadData = useCallback(async () => {
    const { profiles: p, recentRuns: r, totalLeads: t } = await fetchZillowSyncStatus();
    setProfiles(p);
    setRecentRuns(r);
    setTotalLeads(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll every 10 s while any run is active; also call collect_agents for partial runs
  useEffect(() => {
    const hasActive = recentRuns.some(
      (r) => r.status === 'running' || r.status === 'partial' || r.status === 'paused',
    );
    if (!hasActive) return;

    const interval = setInterval(async () => {
      // Collect agent results for any partial run
      for (const run of recentRuns) {
        if (run.status === 'partial') {
          await collectZillowAgents(run.id);
        }
      }
      loadData();
    }, 15_000);

    return () => clearInterval(interval);
  }, [recentRuns, loadData]);

  const activeRunByProfile = (profileId: string): ZillowSyncRun | null =>
    recentRuns.find(
      (r) => r.profile_id === profileId && (r.status === 'running' || r.status === 'paused'),
    ) ?? null;

  const handleCreateProfile = async (form: ProfileFormState) => {
    setSavingNew(true);
    const searchConfig = formToSearchConfig(form);
    const { profile, error } = await createZillowProfile({
      displayName: form.displayName,
      searchConfig,
      enabled: form.enabled,
    });
    setSavingNew(false);
    if (error) { toast.error(error); return; }
    if (profile) setProfiles((prev) => [...prev, profile]);
    setShowNewForm(false);
    toast.success('Profile created');
  };

  const handleUpdateProfile = (updated: ZillowSyncProfile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDeleteProfile = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Zillow Apify Sync</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scrape Zillow listings and enrich agent/broker data via Apify.{' '}
            {totalLeads > 0 && <span className="font-medium">{totalLeads.toLocaleString()} total agent leads.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNewForm(true)} disabled={showNewForm}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Profile
          </Button>
        </div>
      </div>

      {/* New profile form */}
      {showNewForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Sync Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              onSave={handleCreateProfile}
              onCancel={() => setShowNewForm(false)}
              saving={savingNew}
            />
          </CardContent>
        </Card>
      )}

      {/* Profiles */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 && !showNewForm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Globe className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No sync profiles yet</p>
              <p className="text-sm text-muted-foreground">Add a profile with a Zillow search URL to start scraping.</p>
            </div>
            <Button size="sm" onClick={() => setShowNewForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              activeRun={activeRunByProfile(profile.id)}
              onRefresh={loadData}
              onUpdate={handleUpdateProfile}
              onDelete={handleDeleteProfile}
            />
          ))}
        </div>
      )}

      {/* Config reminder */}
      {profiles.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Configure your Apify API token in{' '}
          <a href="/admin/integrations" className="underline underline-offset-2">
            Admin › Integrations › Apify
          </a>{' '}
          before starting a sync.
        </p>
      )}
    </div>
  );
}
