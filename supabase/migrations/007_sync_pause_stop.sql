-- User-controlled pause and stop for inventory sync runs

ALTER TABLE public.inventory_sync_runs
  DROP CONSTRAINT IF EXISTS inventory_sync_runs_status_check;

ALTER TABLE public.inventory_sync_runs
  ADD CONSTRAINT inventory_sync_runs_status_check
  CHECK (status IN ('running', 'success', 'failed', 'partial', 'paused', 'stopped'));
