-- Nightly incremental sync for all enabled Bridge MLS profiles.
-- Runs at 19:00 UTC (1 PM CT / 2 PM ET) — after daily MLS data updates.
-- Reads the anon key from Vault (same pattern as 011_cron_use_vault.sql).
--
-- Before running: ensure the anon key is in Vault:
--   SELECT vault.create_secret('your-anon-key', 'supabase_anon_key');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bridge-mls-nightly-incremental') THEN
    PERFORM cron.unschedule('bridge-mls-nightly-incremental');
  END IF;
END
$$;

SELECT
  cron.schedule(
    'bridge-mls-nightly-incremental',
    '0 19 * * *',
    $$
    SELECT
      net.http_post(
        url     := 'https://abpxitlgresjdiwpmzbb.supabase.co/functions/v1/bridge-mls-cron',
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
