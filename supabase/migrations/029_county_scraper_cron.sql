-- Schedule county scraper daily at 7:00 AM Eastern (11:00 UTC during daylight saving time).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'county-scraper-daily') THEN
    PERFORM cron.unschedule('county-scraper-daily');
  END IF;
END
$$;

SELECT cron.schedule(
  'county-scraper-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://abpxitlgresjdiwpmzbb.supabase.co/functions/v1/county-scraper-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
