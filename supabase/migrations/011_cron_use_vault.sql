-- Update the nightly cron job to read the anon key from Vault
-- (ALTER DATABASE SET requires superuser; Vault works with standard Supabase permissions)
--
-- Before running this migration, store the key once in the Dashboard → SQL Editor:
--
--   SELECT vault.create_secret('your-anon-key', 'supabase_anon_key');

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
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'supabase_anon_key' LIMIT 1
          ),
          'apikey', (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'supabase_anon_key' LIMIT 1
          )
        ),
        body    := '{}'::jsonb
      ) AS request_id;
    $$
  );
