-- Auction.com Apify channel: sync runs and persistent listing staging.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. auction_apify_sync_runs
-- One global sync run at a time; processes US states sequentially.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_apify_sync_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status              TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'partial', 'paused', 'stopped')),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  listings_scraped    INT NOT NULL DEFAULT 0,
  error_message       TEXT,
  -- Keys: pending_states[], processed_states[], active_state, active_run_id,
  --       total_states, start_failures, state_item_counts
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_auction_sync_runs_status
  ON public.auction_apify_sync_runs(status) WHERE status IN ('running', 'partial', 'paused');
CREATE INDEX IF NOT EXISTS idx_auction_sync_runs_started
  ON public.auction_apify_sync_runs(started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. auction_listing_staging
-- Persistent upsert on auction_id (Auction.com numeric id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_listing_staging (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id              TEXT NOT NULL UNIQUE,
  sync_run_id             UUID REFERENCES public.auction_apify_sync_runs(id) ON DELETE SET NULL,
  url                     TEXT,
  address                 TEXT,
  state                   TEXT,
  county                  TEXT,
  municipality            TEXT,
  postal_code             TEXT,
  street_description      TEXT,
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  beds                    INT,
  baths                   NUMERIC,
  sqft                    NUMERIC,
  lot_sqft                NUMERIC,
  year_built              INT,
  property_type           TEXT,
  property_type_group     TEXT,
  sale_type               TEXT,
  opening_bid             NUMERIC,
  starting_bid_amount     NUMERIC,
  auction_start_date      TIMESTAMPTZ,
  auction_end_date        TIMESTAMPTZ,
  auction_date            TEXT,
  auction_time            TEXT,
  auction_location        TEXT,
  status                  TEXT,
  occupancy_status        TEXT,
  buyer_premium_available BOOLEAN NOT NULL DEFAULT false,
  interior_access_allowed BOOLEAN NOT NULL DEFAULT false,
  is_first_look_enabled   BOOLEAN NOT NULL DEFAULT false,
  is_direct_offer_enabled BOOLEAN NOT NULL DEFAULT false,
  primary_photo_url       TEXT,
  raw                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_scraped_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_staging_state
  ON public.auction_listing_staging(state);
CREATE INDEX IF NOT EXISTS idx_auction_staging_sale_type
  ON public.auction_listing_staging(sale_type);
CREATE INDEX IF NOT EXISTS idx_auction_staging_last_scraped
  ON public.auction_listing_staging(last_scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_staging_auction_start
  ON public.auction_listing_staging(auction_start_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — deny direct access; Edge Functions use service role
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.auction_apify_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_listing_staging     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'auction_apify_sync_runs',
    'auction_listing_staging'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'deny_all_direct_access'
    ) THEN
      EXECUTE format(
        $p$CREATE POLICY "deny_all_direct_access" ON public.%I
          AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)$p$,
        t
      );
    END IF;
  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Daily cron — 13:00 UTC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auction-apify-daily') THEN
    PERFORM cron.unschedule('auction-apify-daily');
  END IF;
END
$$;

SELECT cron.schedule(
  'auction-apify-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://abpxitlgresjdiwpmzbb.supabase.co/functions/v1/auction-apify-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true),
      'apikey', current_setting('app.supabase_anon_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
