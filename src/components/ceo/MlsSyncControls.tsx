import { useCallback, useState } from 'react';
import { Loader2, Pause, Play, RefreshCw, Square, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  getMlsSyncStatus,
  startMlsSync,
  pauseMlsSync,
  resumeMlsSync,
  stopMlsSync,
  type MlsSyncStatus,
  type ProfileSyncState,
} from '@/services/bridgeMls';

const POLL_MS = 3000;
const MAX_POLL_LOOPS = 120; // 6 min cap

interface Props {
  status: MlsSyncStatus | null;
  onStatusChange: (s: MlsSyncStatus) => void;
  compact?: boolean;
}

export default function MlsSyncControls({ status, onStatusChange, compact = false }: Props) {
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const { data } = await getMlsSyncStatus();
    if (data) onStatusChange(data);
    return data;
  }, [onStatusChange]);

  const pollUntilSettled = useCallback(async () => {
    for (let i = 0; i < MAX_POLL_LOOPS; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const data = await refreshStatus();
      const anyRunning = data?.profiles.some((p) => p.syncInProgress);
      if (!anyRunning) break;
    }
  }, [refreshStatus]);

  const anyRunning = status?.profiles.some((p) => p.syncInProgress) ?? false;
  const anyPaused = status?.profiles.some((p) => p.canResume) ?? false;
  const bridgeConnected = status?.bridgeConnected ?? false;
  const enabledProfiles = status?.profiles.filter((p) => p.enabled) ?? [];

  // Active run for pause/resume/stop — pick first one in a controllable state
  const runningProfile: ProfileSyncState | undefined = status?.profiles.find((p) => p.syncInProgress);
  const pausedProfile: ProfileSyncState | undefined = status?.profiles.find((p) => p.canResume);

  const handleSync = async (mode: 'full' | 'incremental') => {
    if (!bridgeConnected) { toast.error('Connect the Bridge / Zillow integration first'); return; }
    if (enabledProfiles.length === 0) { toast.error('Enable at least one MLS profile first'); return; }
    setBusy(true);
    const { error } = await startMlsSync({ mode });
    if (error) { toast.error(error); setBusy(false); return; }
    toast.message(`MLS sync started (${mode})`, { id: 'mls-sync', duration: 2000 });
    await pollUntilSettled();
    toast.dismiss('mls-sync');
    toast.success('MLS sync complete');
    setBusy(false);
  };

  const handlePause = async () => {
    if (!runningProfile?.lastRun?.id) return;
    setBusy(true);
    const { error } = await pauseMlsSync(runningProfile.lastRun.id);
    setBusy(false);
    if (error) toast.error(error); else { toast.success('Sync paused'); await refreshStatus(); }
  };

  const handleResume = async () => {
    if (!pausedProfile?.lastRun?.id) return;
    setBusy(true);
    const { error } = await resumeMlsSync(pausedProfile.lastRun.id);
    if (error) { toast.error(error); setBusy(false); return; }
    toast.message('Resuming sync…', { id: 'mls-sync', duration: 2000 });
    await pollUntilSettled();
    toast.dismiss('mls-sync');
    toast.success('MLS sync complete');
    setBusy(false);
  };

  const handleStop = async () => {
    const target = runningProfile ?? pausedProfile;
    if (!target?.lastRun?.id) return;
    setBusy(true);
    const { error } = await stopMlsSync(target.lastRun.id);
    setBusy(false);
    if (error) toast.error(error); else { toast.success('Sync stopped'); await refreshStatus(); }
  };

  const disabled = busy;
  const btn = compact
    ? 'px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 disabled:opacity-60'
    : 'px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 disabled:opacity-60';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Resume */}
      {!anyRunning && anyPaused && (
        <button
          type="button"
          onClick={handleResume}
          disabled={disabled || !bridgeConnected}
          className={`${btn} bg-primary text-primary-foreground`}
        >
          {disabled ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {busy ? 'Working…' : 'Resume'}
        </button>
      )}

      {/* Incremental */}
      {!anyRunning && !anyPaused && enabledProfiles.length > 0 && (
        <button
          type="button"
          onClick={() => handleSync('incremental')}
          disabled={disabled || !bridgeConnected}
          className={`${btn} bg-primary text-primary-foreground`}
        >
          {disabled ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {busy ? 'Working…' : 'Incremental sync'}
        </button>
      )}

      {/* Full sync */}
      {!anyRunning && !anyPaused && (
        <button
          type="button"
          onClick={() => handleSync('full')}
          disabled={disabled || !bridgeConnected}
          className={`${btn} ${enabledProfiles.length === 0 ? 'bg-muted text-muted-foreground' : 'bg-speed/20 text-speed'}`}
        >
          {disabled ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {busy ? 'Working…' : 'Full sync'}
        </button>
      )}

      {/* Pause / Stop while running */}
      {anyRunning && (
        <>
          <button
            type="button"
            onClick={handlePause}
            disabled={disabled}
            className={`${btn} bg-amber-500/20 text-amber-600`}
          >
            <Pause size={12} />
            Pause
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={disabled}
            className={`${btn} bg-destructive/15 text-destructive`}
          >
            <Square size={12} />
            Stop
          </button>
        </>
      )}

      {/* Progress indicator while running */}
      {anyRunning && (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 size={11} className="animate-spin" />
          Syncing…
        </span>
      )}
    </div>
  );
}
