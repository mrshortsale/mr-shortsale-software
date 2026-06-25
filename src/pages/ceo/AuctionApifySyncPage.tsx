import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { Play, Square, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  fetchAuctionSyncStatus,
  startAuctionSync,
  stopAuctionSync,
  collectAuctionRun,
  type AuctionSyncRun,
} from '@/services/auctionApify';
import {
  AUCTION_US_STATES,
  resolveAuctionSyncStates,
  type AuctionStateMode,
} from '@/config/auctionStates';

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

function runProgress(run: AuctionSyncRun | null): {
  processed: number;
  total: number;
  percent: number;
  activeState: string | null;
} {
  if (!run) return { processed: 0, total: 51, percent: 0, activeState: null };
  const meta = run.metadata ?? {};
  const processed = Array.isArray(meta.processed_states) ? meta.processed_states.length : 0;
  const total = Number(meta.total_states ?? 51);
  const activeState = typeof meta.active_state === 'string' ? meta.active_state : null;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  return { processed, total, percent, activeState };
}

function scopeLabel(meta: Record<string, unknown>): string {
  const scope = meta.sync_scope;
  if (scope === 'count') {
    const n = Number(meta.requested_state_count ?? meta.total_states ?? 0);
    return `First ${n} states`;
  }
  if (scope === 'selected') {
    const states = meta.requested_states;
    if (Array.isArray(states) && states.length <= 3) return states.join(', ');
    if (Array.isArray(states)) return `${states.length} selected`;
    return 'Selected states';
  }
  return 'All states';
}

/** Turn raw edge-function / Apify errors into readable text. */
function formatSyncError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  const jsonMatch = raw.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        error?: { type?: string; message?: string };
      };
      const apifyMessage = parsed?.error?.message;
      const apifyType = parsed?.error?.type;
      const prefix = raw.slice(0, raw.indexOf(jsonMatch[0])).trim();

      if (apifyMessage) {
        const parts = [prefix.replace(/:\s*$/, ''), apifyMessage].filter(Boolean);
        if (apifyType === 'user-or-token-not-found') {
          parts.push('Update your Apify API token in Admin › Integrations.');
        }
        return parts.join(' — ');
      }
    } catch {
      // fall through to raw string
    }
  }

  return raw.trim();
}

function runErrorMessage(run: AuctionSyncRun): string | null {
  return formatSyncError(run.error_message)
    ?? formatSyncError(
      typeof run.metadata?.last_start_error === 'string'
        ? run.metadata.last_start_error
        : null,
    );
}

const QUICK_PICKS = ['Florida', 'Texas', 'California', 'Ohio', 'Georgia', 'New York'];

export default function AuctionApifySyncPage() {
  const [recentRuns, setRecentRuns] = useState<AuctionSyncRun[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [activeRun, setActiveRun] = useState<AuctionSyncRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stateMode, setStateMode] = useState<AuctionStateMode>('all');
  const [stateCount, setStateCount] = useState(5);
  const [selectedStates, setSelectedStates] = useState<string[]>(['Florida', 'Texas']);

  const plannedStates = useMemo(
    () => resolveAuctionSyncStates({
      stateMode,
      stateCount,
      states: selectedStates,
    }),
    [stateMode, stateCount, selectedStates],
  );

  const loadData = useCallback(async () => {
    const data = await fetchAuctionSyncStatus();
    if (data.error) toast.error(data.error);
    setRecentRuns(data.recentRuns);
    setTotalListings(data.totalListings);
    setActiveRun(data.activeRun);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const hasActive = recentRuns.some(
      (r) => r.status === 'running' || r.status === 'partial' || r.status === 'paused',
    );
    if (!hasActive) return;

    const interval = setInterval(async () => {
      for (const run of recentRuns) {
        if (run.status === 'running' || run.status === 'partial') {
          await collectAuctionRun(run.id);
        }
      }
      loadData();
    }, 15_000);

    return () => clearInterval(interval);
  }, [recentRuns, loadData]);

  const toggleState = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state],
    );
  };

  const handleSync = async () => {
    if (stateMode === 'selected' && selectedStates.length === 0) {
      toast.error('Select at least one state');
      return;
    }

    setSyncing(true);
    const { runId, error } = await startAuctionSync({
      stateMode,
      stateCount: stateMode === 'count' ? stateCount : undefined,
      states: stateMode === 'selected' ? selectedStates : undefined,
    });
    setSyncing(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      `Sync started for ${plannedStates.length} state${plannedStates.length !== 1 ? 's' : ''}${
        runId ? ` (${runId.slice(0, 8)}…)` : ''
      }`,
    );
    loadData();
  };

  const handleStop = async () => {
    if (!activeRun) return;
    const { error } = await stopAuctionSync(activeRun.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Sync stopped');
    loadData();
  };

  const handleCollect = async () => {
    if (!activeRun) return;
    const result = await collectAuctionRun(activeRun.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.done) toast.success('Sync complete');
    loadData();
  };

  const progress = runProgress(activeRun);
  const isActive = !!activeRun && ['running', 'partial', 'paused'].includes(activeRun.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auction.com Sync</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scrape foreclosure and auction listings from Auction.com via Apify.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm shrink-0">
          {totalListings.toLocaleString()} listings
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Sync Configuration</CardTitle>
            <div className="flex items-center gap-2">
              {isActive ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCollect}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Check Progress
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleStop}>
                    <Square className="h-3.5 w-3.5 mr-1" />
                    Stop
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1" />
                  )}
                  Start Sync
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isActive && (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  States to sync
                </Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'All 51 states'],
                    ['count', 'First N states'],
                    ['selected', 'Pick states'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setStateMode(mode)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        stateMode === mode
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {stateMode === 'count' && (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="state-count">Number of states</Label>
                  <Input
                    id="state-count"
                    type="number"
                    min={1}
                    max={AUCTION_US_STATES.length}
                    value={stateCount}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setStateCount(
                        Number.isFinite(n)
                          ? Math.min(Math.max(1, n), AUCTION_US_STATES.length)
                          : 1,
                      );
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Runs alphabetically from Alabama through state #{stateCount}.
                  </p>
                </div>
              )}

              {stateMode === 'selected' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PICKS.map((state) => (
                      <button
                        key={state}
                        type="button"
                        onClick={() => toggleState(state)}
                        className={`px-2.5 py-1 rounded-full text-xs border ${
                          selectedStates.includes(state)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-border'
                        }`}
                      >
                        {state}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedStates([...AUCTION_US_STATES])}
                      className="px-2.5 py-1 rounded-full text-xs border bg-background hover:bg-muted border-border"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStates([])}
                      className="px-2.5 py-1 rounded-full text-xs border bg-background hover:bg-muted border-border"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-background p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AUCTION_US_STATES.map((state) => (
                      <label
                        key={state}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStates.includes(state)}
                          onChange={() => toggleState(state)}
                          className="rounded"
                        />
                        <span className="truncate">{state}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                This run will process <strong>{plannedStates.length}</strong> state
                {plannedStates.length !== 1 ? 's' : ''} (max 2,000 listings per state).
                Only active auctions are stored (not ended); Bank Owned is excluded.
                {stateMode === 'count' && plannedStates.length > 0 && (
                  <> Starting with {plannedStates[0]}.</>
                )}
              </p>
            </div>
          )}

          {isActive && activeRun ? (
            <>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {statusBadge(activeRun.status)}
                <span className="text-muted-foreground">
                  {progress.processed} / {progress.total} states
                  {progress.activeState ? ` · scraping ${progress.activeState}` : ''}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {scopeLabel(activeRun.metadata ?? {})}
                </Badge>
              </div>
              <Progress value={progress.percent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {activeRun.listings_scraped.toLocaleString()} listings upserted this run
              </p>
              {runErrorMessage(activeRun) && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {runErrorMessage(activeRun)}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Scheduled daily cron still runs all 51 states at 13:00 UTC. Manual runs use the scope above.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Started</th>
                    <th className="pb-2 pr-4 font-medium">Scope</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Listings</th>
                    <th className="pb-2 pr-4 font-medium">States</th>
                    <th className="pb-2 font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => {
                    const meta = run.metadata ?? {};
                    const processed = Array.isArray(meta.processed_states)
                      ? meta.processed_states.length
                      : 0;
                    const total = Number(meta.total_states ?? 51);
                    const errorText = runErrorMessage(run);
                    const showError = !!errorText && ['failed', 'stopped'].includes(run.status);

                    return (
                      <Fragment key={run.id}>
                        <tr className="border-b">
                          <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(run.started_at)}</td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                            {scopeLabel(meta)}
                          </td>
                          <td className="py-2 pr-4">{statusBadge(run.status)}</td>
                          <td className="py-2 pr-4">{run.listings_scraped.toLocaleString()}</td>
                          <td className="py-2 pr-4">{processed}/{total}</td>
                          <td className="py-2 whitespace-nowrap">{fmtDate(run.completed_at)}</td>
                        </tr>
                        {showError && (
                          <tr className="border-b last:border-0">
                            <td colSpan={6} className="pb-3 pt-0 px-0">
                              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive leading-relaxed">
                                <span className="font-semibold">Error — </span>
                                {errorText}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Configure your Apify API token in Admin › Integrations. Actor: parseforge/auction-com-property-scraper.
      </p>
    </div>
  );
}
