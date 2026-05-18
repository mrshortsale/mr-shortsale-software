-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─────────────────────────────────────────────────────────────────────────────
-- ONE-TIME SETUP — run this first in Supabase Dashboard → SQL Editor:
--
--   ALTER DATABASE postgres
--     SET app.supabase_anon_key = '<paste your VITE_SUPABASE_ANON_KEY here>';
--
-- The anon key is safe to store here (it is already public — shipped in the
-- browser bundle as VITE_SUPABASE_ANON_KEY). It is only used so the Supabase
-- API gateway can route the request to the batchleads-cron edge function.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove any existing job before (re)creating it so this migration is idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-leads-nightly-incremental') THEN
    PERFORM cron.unschedule('batch-leads-nightly-incremental');
  END IF;
END
$$;

-- Schedule incremental sync nightly at midnight Bangladesh time (18:00 UTC).
-- batchleads-cron auto-detects incremental vs full and skips if already running.
SELECT
  cron.schedule(
    'batch-leads-nightly-incremental',
    '0 18 * * *',
    $$
    SELECT
      net.http_post(
        url     := 'https://abpxitlgresjdiwpmzbb.supabase.co/functions/v1/batchleads-cron',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true),
          'apikey',        current_setting('app.supabase_anon_key', true)
        ),
        body    := '{}'::jsonb
      ) AS request_id;
    $$
  );
