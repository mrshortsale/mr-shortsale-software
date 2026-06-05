import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronRight, Loader2, Plus, RefreshCw,
  TestTube2, Trash2, X, XCircle, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  listMlsProfiles,
  createMlsProfile,
  updateMlsProfile,
  deleteMlsProfile,
  testMlsProfile,
  discoverMlsDatasets,
  startMlsSync,
  type MlsSyncProfile,
  type MlsDataset,
} from '@/services/bridgeMls';

const DEFAULT_KEYWORDS = ['short sale', 'shortsale'];
const DEFAULT_CONDITIONS = [
  'Pre-Foreclosure', 'In Foreclosure', 'Bankruptcy Property', 'Short Sale', 'Notice Of Default',
];

interface ProfileEditorState {
  displayName: string;
  enabled: boolean;
  stateAllowlist: string;
  keywordFilters: string;
  conditionFilters: string;
  odataFilterOverride: string;
  pageSize: string;
  sortOrder: string;
  showAdvanced: boolean;
}

function defaultEditor(p?: MlsSyncProfile): ProfileEditorState {
  return {
    displayName: p?.display_name ?? '',
    enabled: p?.enabled ?? false,
    stateAllowlist: (p?.state_allowlist ?? []).join(', '),
    keywordFilters: (p?.keyword_filters ?? DEFAULT_KEYWORDS).join(', '),
    conditionFilters: (p?.condition_filters ?? DEFAULT_CONDITIONS).join(', '),
    odataFilterOverride: p?.odata_filter_override ?? '',
    pageSize: String(p?.page_size ?? 200),
    sortOrder: p?.sort_order ?? 'DaysOnMarket desc',
    showAdvanced: false,
  };
}

function splitTrim(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

interface ProfileRowProps {
  profile: MlsSyncProfile;
  onUpdated: (p: MlsSyncProfile) => void;
  onDeleted: (id: string) => void;
}

function ProfileRow({ profile, onUpdated, onDeleted }: ProfileRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editor, setEditor] = useState<ProfileEditorState>(defaultEditor(profile));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { profile: updated, error } = await updateMlsProfile(profile.id, {
      displayName: editor.displayName.trim(),
      enabled: editor.enabled,
      stateAllowlist: splitTrim(editor.stateAllowlist),
      keywordFilters: splitTrim(editor.keywordFilters),
      conditionFilters: splitTrim(editor.conditionFilters),
      odataFilterOverride: editor.odataFilterOverride.trim() || null,
      pageSize: Math.min(200, Math.max(1, Number(editor.pageSize) || 200)),
      sortOrder: editor.sortOrder.trim() || 'DaysOnMarket desc',
    });
    setSaving(false);
    if (error) {
      toast.error(error);
    } else if (updated) {
      toast.success('Profile saved');
      setEditor(defaultEditor(updated));
      onUpdated(updated);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const { result, error } = await testMlsProfile(profile.id);
    setTesting(false);
    if (error) {
      toast.error(`Test failed: ${error}`);
    } else if (result?.success) {
      toast.success(`Connected (${result.latency_ms}ms)${result.sample ? ' — sample listing found' : ''}`);
      onUpdated({ ...profile, last_test_status: 'success', last_tested_at: new Date().toISOString() });
    } else {
      toast.error(`Test failed: ${result?.error ?? 'No data returned'}`);
      onUpdated({ ...profile, last_test_status: 'failure', last_tested_at: new Date().toISOString() });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const { error } = await startMlsSync({ profileId: profile.id, mode: 'full' });
    setSyncing(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`Sync started for ${profile.display_name}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete profile "${profile.display_name}"? This removes all agent leads for this feed.`)) return;
    setDeleting(true);
    const { error } = await deleteMlsProfile(profile.id);
    setDeleting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Profile deleted');
      onDeleted(profile.id);
    }
  };

  const testBadge = profile.last_test_status === 'success'
    ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Tested</Badge>
    : profile.last_test_status === 'failure'
    ? <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
    : <Badge variant="outline" className="text-muted-foreground text-[10px]">Not tested</Badge>;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">{profile.display_name}</span>
          <span className="ml-2 text-xs font-mono text-muted-foreground">{profile.dataset_id}</span>
        </div>
        {testBadge}
        <Badge variant={profile.enabled ? 'default' : 'outline'} className="text-[10px]">
          {profile.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <TestTube2 className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input
                className="h-8 text-sm"
                value={editor.displayName}
                onChange={(e) => setEditor((s) => ({ ...s, displayName: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch
                checked={editor.enabled}
                onCheckedChange={(v) => setEditor((s) => ({ ...s, enabled: v }))}
              />
              <Label className="text-xs">{editor.enabled ? 'Enabled for sync' : 'Disabled'}</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">State Allowlist <span className="text-muted-foreground">(comma-separated, e.g. TX, FL — empty = all states)</span></Label>
            <Input
              className="h-8 text-sm"
              placeholder="TX, FL, CA"
              value={editor.stateAllowlist}
              onChange={(e) => setEditor((s) => ({ ...s, stateAllowlist: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Keyword Filters <span className="text-muted-foreground">(PublicRemarks, comma-separated)</span></Label>
              <Input
                className="h-8 text-sm"
                value={editor.keywordFilters}
                onChange={(e) => setEditor((s) => ({ ...s, keywordFilters: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Special Listing Conditions <span className="text-muted-foreground">(comma-separated)</span></Label>
              <Input
                className="h-8 text-sm"
                value={editor.conditionFilters}
                onChange={(e) => setEditor((s) => ({ ...s, conditionFilters: e.target.value }))}
              />
            </div>
          </div>

          {/* Advanced section */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditor((s) => ({ ...s, showAdvanced: !s.showAdvanced }))}
            >
              {editor.showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Advanced
            </button>

            {editor.showAdvanced && (
              <div className="mt-3 space-y-3 pl-4 border-l">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    OData Filter Override{' '}
                    <span className="text-amber-500">⚠ Replaces preset builder entirely — incremental watermark not applied automatically</span>
                  </Label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y min-h-[80px]"
                    placeholder="e.g. contains(PublicRemarks,'bank owned') and StateOrProvince eq 'TX'"
                    value={editor.odataFilterOverride}
                    onChange={(e) => setEditor((s) => ({ ...s, odataFilterOverride: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Page Size <span className="text-muted-foreground">(max 200)</span></Label>
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={1}
                      max={200}
                      value={editor.pageSize}
                      onChange={(e) => setEditor((s) => ({ ...s, pageSize: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sort Order</Label>
                    <Input
                      className="h-8 text-sm"
                      value={editor.sortOrder}
                      onChange={(e) => setEditor((s) => ({ ...s, sortOrder: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive text-xs h-7"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
              Delete profile
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  integrationConnected: boolean;
}

export default function MlsProfilesPanel({ integrationConnected }: Props) {
  const [profiles, setProfiles] = useState<MlsSyncProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredDatasets, setDiscoveredDatasets] = useState<MlsDataset[]>([]);
  const [addMode, setAddMode] = useState<'none' | 'discover' | 'manual'>('none');
  const [newDatasetId, setNewDatasetId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { profiles: ps } = await listMlsProfiles();
    setProfiles(ps);
    setLoading(false);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleDiscover = async () => {
    setDiscovering(true);
    const { datasets, error } = await discoverMlsDatasets();
    setDiscovering(false);
    if (error) {
      toast.error(`Could not discover datasets: ${error}`);
    } else {
      setDiscoveredDatasets(datasets);
      setAddMode('discover');
    }
  };

  const handleAdd = async () => {
    const id = newDatasetId.trim();
    if (!id) { toast.error('Dataset ID is required'); return; }
    setAdding(true);
    const { profile, error } = await createMlsProfile(id, newDisplayName.trim() || id);
    setAdding(false);
    if (error) {
      toast.error(error);
    } else if (profile) {
      setProfiles((prev) => [...prev, profile]);
      setNewDatasetId('');
      setNewDisplayName('');
      setAddMode('none');
      toast.success(`Profile created for ${profile.dataset_id}`);
    }
  };

  const handleSelectDiscovered = (ds: MlsDataset) => {
    setNewDatasetId(ds.id);
    setNewDisplayName(ds.name);
    setAddMode('manual');
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>MLS Feeds</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Each feed is an approved Bridge dataset. One API key services all feeds.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!integrationConnected && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
            Connect the Zillow / Bridge integration above before adding MLS feeds.
          </div>
        )}

        {/* Existing profiles */}
        {profiles.map((p) => (
          <ProfileRow
            key={p.id}
            profile={p}
            onUpdated={(updated) => setProfiles((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
            onDeleted={(id) => setProfiles((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}

        {profiles.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground py-2">
            No MLS feeds yet. Add one below to start syncing short-sale agents.
          </p>
        )}

        {/* Discover from Bridge */}
        {addMode === 'discover' && discoveredDatasets.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Approved datasets on your Bridge account</p>
              <button onClick={() => setAddMode('none')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {discoveredDatasets.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => handleSelectDiscovered(ds)}
                  className="flex items-center justify-between rounded border px-2 py-1.5 text-xs hover:bg-muted text-left"
                >
                  <div>
                    <span className="font-medium">{ds.name || ds.id}</span>
                    <span className="ml-2 font-mono text-muted-foreground">{ds.id}</span>
                  </div>
                  {ds.recordCount != null && (
                    <span className="text-muted-foreground">{ds.recordCount.toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual / confirm add form */}
        {addMode === 'manual' && (
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Add MLS feed</p>
              <button onClick={() => setAddMode('none')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dataset ID *</Label>
                <Input
                  className="h-8 text-sm font-mono"
                  placeholder="actris_ref"
                  value={newDatasetId}
                  onChange={(e) => setNewDatasetId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="ACTRIS (Austin, TX)"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddMode('none')}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={adding || !newDatasetId.trim()}>
                {adding ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                Add feed
              </Button>
            </div>
          </div>
        )}

        {/* Add buttons */}
        {addMode === 'none' && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleDiscover}
              disabled={discovering || !integrationConnected}
            >
              {discovering ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Discover from Bridge
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setAddMode('manual')}
              disabled={!integrationConnected}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add manually
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
