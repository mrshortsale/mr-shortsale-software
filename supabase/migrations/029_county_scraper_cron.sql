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
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://abpxitlgresjdiwpmzbb.supabase.co/functions/v1/county-scraper-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true),
      'apikey', current_setting('app.supabase_anon_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
