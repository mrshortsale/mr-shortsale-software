import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, History, Loader2, Pause, Play, RefreshCw, RotateCcw, Square, Zap } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [confirmFullRefresh, setConfirmFullRefresh] = useState(false);
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';

  const refreshStatus = useCallback(async () => {
    const { data } = await getBatchSyncStatus();
    if (data) onStatusChange(data);
    return data;
  }, [onStatusChange]);

  const pollUntilSettled = useCallback(async (mode?: 'incremental' | 'full') => {
    const { leadsInDb, completed, error } = await waitForBatchSyncComplete((s) => {
      onStatusChange(s);
    });
    await refreshStatus();
    if (error && !completed) toast.message(error, { duration: 6000 });
    else if (completed) {
      if (mode === 'incremental') {
        toast.success(t('sync.toasts.incrementalComplete', { count: leadsInDb.toLocaleString(loc) }));
      } else {
        toast.success(t('sync.toasts.fullComplete', { count: leadsInDb.toLocaleString(loc) }));
      }
    }
    await onComplete?.();
  }, [onStatusChange, onComplete, refreshStatus]);

  const runSync = async (mode: 'incremental' | 'full', force = false) => {
    if (!batchConnected) {
      toast.error(t('sync.toasts.connectFirst'));
      return;
    }
    onSyncingChange(true);
    setBusy(true);
    try {
      const { completed, error } = await syncBatchLeadsUntilComplete(
        (progress) => {
          if (mode === 'incremental') {
            const n = progress.cumulativeNew ?? 0;
            const u = progress.cumulativeUpdated ?? 0;
            const pages = progress.pagesProcessedTotal ?? 0;
            toast.message(
              n > 0 || u > 0
                ? t('sync.toasts.incrementalProgress', { new: n.toLocaleString(loc), updated: u.toLocaleString(loc), pages })
                : t('sync.toasts.incrementalScanning'),
              { id: 'batch-sync', duration: 2000 },
            );
          } else {
            toast.message(t('sync.toasts.syncingLeads', { count: progress.leadsInDb.toLocaleString(loc) }), {
              id: 'batch-sync',
              duration: 2000,
            });
          }
        },
        { force, mode },
      );
      toast.dismiss('batch-sync');
      if (!completed) await pollUntilSettled(mode);
      else if (error) toast.message(error, { duration: 6000 });
      else await onComplete?.();
    } finally {
      onSyncingChange(false);
      setBusy(false);
      await refreshStatus();
    }
  };

  const handleIncremental = () => runSync('incremental');

  const handleFullRefresh = () => {
    if (syncStatus?.leadsInDb && syncStatus.leadsInDb > 0) {
      setConfirmFullRefresh(true);
    } else {
      runSync('full', true);
    }
  };

  const handleResume = async () => {
    if (!batchConnected) {
      toast.error(t('sync.toasts.connectFirst'));
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
      toast.message(t('sync.toasts.resuming'), { id: 'batch-sync' });
      const resumedMode = syncStatus?.lastRun?.metadata?.mode ?? 'full';
      await pollUntilSettled(resumedMode);
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
      else toast.success(t('sync.toasts.paused'));
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
      else toast.success(t('sync.toasts.stopped'));
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
  const hasBaseline = syncStatus?.hasIncrementalBaseline ?? false;

  const btn = compact
    ? 'px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 disabled:opacity-60'
    : 'px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 disabled:opacity-60';

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Resume button — shown when there's a paused/partial run */}
        {!isRunning && canResume && (
          <button
            type="button"
            onClick={handleResume}
            disabled={disabled || !batchConnected}
            className={`${btn} bg-primary text-primary-foreground`}
          >
            {disabled ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {disabled ? t('sync.buttons.working') : t('sync.buttons.resume')}
          </button>
        )}

        {/* Incremental sync — primary action when baseline exists and nothing is running/resumable */}
        {!isRunning && !canResume && hasBaseline && (
          <button
            type="button"
            onClick={handleIncremental}
            disabled={disabled || !batchConnected}
            className={`${btn} bg-primary text-primary-foreground`}
            title={t('sync.tooltips.incremental')}
          >
            {disabled ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {disabled ? t('sync.buttons.working') : t('sync.buttons.incremental')}
          </button>
        )}

        {/* Full refresh — always available when not running; first-time sync when no baseline */}
        {!isRunning && !canResume && (
          <button
            type="button"
            onClick={hasBaseline ? handleFullRefresh : () => runSync('full', !wasStopped)}
            disabled={disabled || !batchConnected}
            className={hasBaseline
              ? `${btn} bg-muted text-foreground border`
              : `${btn} bg-primary text-primary-foreground`
            }
            title={hasBaseline
              ? t('sync.tooltips.fullRefresh')
              : t('sync.tooltips.firstSync')
            }
          >
            {disabled ? <Loader2 size={12} className="animate-spin" /> : hasBaseline ? <RotateCcw size={12} /> : <RefreshCw size={12} />}
            {disabled ? t('sync.buttons.working') : wasStopped && !hasBaseline ? t('sync.buttons.newSync') : hasBaseline ? t('sync.buttons.fullRefresh') : t('sync.buttons.syncBatch')}
          </button>
        )}

        {isRunning && canPause && (
          <button
            type="button"
            onClick={handlePause}
            disabled={disabled}
            className={`${btn} bg-muted text-foreground border`}
          >
            <Pause size={12} /> {t('sync.buttons.pause')}
          </button>
        )}
        {canStop && (
          <button
            type="button"
            onClick={handleStop}
            disabled={disabled}
            className={`${btn} bg-destructive/10 text-destructive border border-destructive/30`}
          >
            <Square size={12} /> {t('sync.buttons.stop')}
          </button>
        )}
        {showHistoryLink && (
          <Link
            to={`${CEO_BASE}/sync-runs`}
            className={`${btn} bg-muted text-muted-foreground hover:text-foreground`}
          >
            <History size={12} /> {t('sync.buttons.history')}
          </Link>
        )}
      </div>

      {/* Full refresh confirmation dialog */}
      <AlertDialog open={confirmFullRefresh} onOpenChange={setConfirmFullRefresh}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              {t('sync.dialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('sync.dialog.description', { count: syncStatus?.leadsInDb?.toLocaleString(loc) ?? '70k' })}
              <br /><br />
              {t('sync.dialog.incrementalNote')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sync.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setConfirmFullRefresh(false);
                runSync('full', true);
              }}
            >
              {t('sync.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
