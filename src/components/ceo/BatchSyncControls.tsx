import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pause, Play, RefreshCw, Square, History } from 'lucide-react';
import { toast } from 'sonner';
import { CEO_BASE } from '@/config/ceoNav';
import {
  getBatchSyncStatus,
  pauseBatchSync,
  resumeBatchLeads,
  stopBatchSync,
  syncBatchLeadsUntilComplete,
  waitForBatchSyncComplete,
  type InventorySyncStatus,
} from '@/services/inventory';

interface BatchSyncControlsProps {
  batchConnected: boolean;
  syncStatus: InventorySyncStatus | null;
  syncing: boolean;
  onSyncingChange: (syncing: boolean) => void;
  onStatusChange: (status: InventorySyncStatus | null) => void;
  onComplete?: () => void | Promise<void>;
  showHistoryLink?: boolean;
  compact?: boolean;
}

export default function BatchSyncControls({
  batchConnected,
  syncStatus,
  syncing,
  onSyncingChange,
  onStatusChange,
  onComplete,
  showHistoryLink = true,
  compact = false,
}: BatchSyncControlsProps) {
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const { data } = await getBatchSyncStatus();
    if (data) onStatusChange(data);
    return data;
  }, [onStatusChange]);

  const pollUntilSettled = useCallback(async () => {
    const { totalUpserted, completed, error } = await waitForBatchSyncComplete((s) => {
      onStatusChange(s);
    });
    await refreshStatus();
    if (error && !completed) toast.message(error, { duration: 6000 });
    else if (completed) toast.success(`Sync complete — ${totalUpserted.toLocaleString()} leads`);
    await onComplete?.();
  }, [onStatusChange, onComplete, refreshStatus]);

  const handleStart = async (force = false) => {
    if (!batchConnected) {
      toast.error('Connect Batch Leads under Integrations first');
      return;
    }
    onSyncingChange(true);
    setBusy(true);
    try {
      const { completed, error } = await syncBatchLeadsUntilComplete((progress) => {
        toast.message(`Syncing… ${progress.leadsUpserted.toLocaleString()} leads`, {
          id: 'batch-sync',
          duration: 2000,
        });
      }, { force });
      toast.dismiss('batch-sync');
      if (!completed) await pollUntilSettled();
      else if (error) toast.message(error, { duration: 6000 });
      else await onComplete?.();
    } finally {
      onSyncingChange(false);
      setBusy(false);
      await refreshStatus();
    }
  };

  const handleResume = async () => {
    if (!batchConnected) {
      toast.error('Connect Batch Leads under Integrations first');
      return;
    }
    onSyncingChange(true);
    setBusy(true);
    try {
      const { error } = await resumeBatchLeads(syncStatus?.lastRun?.id);
      if (error) {
        toast.error(error);
        return;
      }
      toast.message('Resuming sync…', { id: 'batch-sync' });
      await pollUntilSettled();
      toast.dismiss('batch-sync');
    } finally {
      onSyncingChange(false);
      setBusy(false);
    }
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      const { error } = await pauseBatchSync(syncStatus?.lastRun?.id);
      if (error) toast.error(error);
      else toast.success('Sync paused');
      await refreshStatus();
      onSyncingChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      const { error } = await stopBatchSync(syncStatus?.lastRun?.id);
      if (error) toast.error(error);
      else toast.success('Sync stopped');
      await refreshStatus();
      onSyncingChange(false);
      await onComplete?.();
    } finally {
      setBusy(false);
    }
  };

  const disabled = syncing || busy;
  const canPause = syncStatus?.canPause;
  const canResume = syncStatus?.canResume && !syncStatus.syncInProgress;
  const canStop = syncStatus?.canStop;
  const isRunning = syncStatus?.syncInProgress;
  const wasStopped = syncStatus?.lastRun?.status === 'stopped';

  const btn = compact
    ? 'px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 disabled:opacity-60'
    : 'px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 disabled:opacity-60';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!isRunning && (
        <button
          type="button"
          onClick={() => (canResume ? handleResume() : handleStart(wasStopped))}
          disabled={disabled || !batchConnected}
          className={`${btn} bg-primary text-primary-foreground`}
        >
          {disabled ? <Loader2 size={12} className="animate-spin" /> : canResume ? <Play size={12} /> : <RefreshCw size={12} />}
          {disabled ? 'Working…' : canResume ? 'Resume' : wasStopped ? 'New sync' : 'Sync Batch'}
        </button>
      )}
      {isRunning && canPause && (
        <button
          type="button"
          onClick={handlePause}
          disabled={disabled}
          className={`${btn} bg-muted text-foreground border`}
        >
          <Pause size={12} /> Pause
        </button>
      )}
      {canStop && (
        <button
          type="button"
          onClick={handleStop}
          disabled={disabled}
          className={`${btn} bg-destructive/10 text-destructive border border-destructive/30`}
        >
          <Square size={12} /> Stop
        </button>
      )}
      {showHistoryLink && (
        <Link
          to={`${CEO_BASE}/sync-runs`}
          className={`${btn} bg-muted text-muted-foreground hover:text-foreground`}
        >
          <History size={12} /> History
        </Link>
      )}
    </div>
  );
}
