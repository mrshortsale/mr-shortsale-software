-- Fix nightly cron job to use app.supabase_anon_key database setting
-- instead of Vault (no extra Vault setup needed).
--
-- ONE-TIME SETUP — run this once in Supabase Dashboard → SQL Editor:
--
--   ALTER DATABASE postgres
--     SET app.supabase_anon_key = '<paste your VITE_SUPABASE_ANON_KEY here>';
--
-- The anon key is safe here — it is already public (shipped in the browser
-- bundle as VITE_SUPABASE_ANON_KEY).

-- Recreate the cron job with the updated header approach
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-leads-nightly-incremental') THEN
    PERFORM cron.unschedule('batch-leads-nightly-incremental');
  END IF;
END
$$;

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
