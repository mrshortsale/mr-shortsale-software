-- Allow interrupted syncs to be resumed; track last progress update

ALTER TABLE public.inventory_sync_runs
  DROP CONSTRAINT IF EXISTS inventory_sync_runs_status_check;

ALTER TABLE public.inventory_sync_runs
  ADD CONSTRAINT inventory_sync_runs_status_check
  CHECK (status IN ('running', 'success', 'failed', 'partial'));

ALTER TABLE public.inventory_sync_runs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: stale "running" rows with saved progress → partial (safe to resume)
UPDATE public.inventory_sync_runs
SET
  status = 'partial',
  error_message = COALESCE(error_message, 'Sync interrupted — resume to continue'),
  updated_at = now()
WHERE status = 'running'
  AND completed_at IS NULL
  AND started_at < now() - interval '5 minutes'
  AND (metadata->>'completed')::boolean IS DISTINCT FROM true
  AND metadata ? 'nextPage';
