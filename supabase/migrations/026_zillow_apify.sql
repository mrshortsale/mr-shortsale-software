-- Zillow Apify channel: integration seed, sync profiles, runs, listing staging, agent leads.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Apify integration entry
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.integrations (
  name, slug, description, category, auth_method, is_builtin, default_base_url, health_check_endpoint
) VALUES (
  'Apify',
  'apify',
  'Zillow Search Scraper + Owner Agent Scraper for short-sale listing agent data.',
  'data',
  'api_key',
  true,
  'https://api.apify.com',
  '/v2/users/me'
)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. zillow_apify_sync_profiles
-- One row per saved search URL / region the CEO wants to scrape.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zillow_apify_sync_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT false,

  -- Zillow search URL fed directly to the search actor
  search_url      TEXT NOT NULL,
  -- Structured builder config used to regenerate / display the URL in the UI
  search_config   JSONB NOT NULL DEFAULT '{}'::jsonb,

  max_listings    INT NOT NULL DEFAULT 500,
  last_synced_at  TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zillow_profiles_integration
  ON public.zillow_apify_sync_profiles(integration_id);
CREATE INDEX IF NOT EXISTS idx_zillow_profiles_enabled
  ON public.zillow_apify_sync_profiles(enabled) WHERE enabled = true;

DROP TRIGGER IF EXISTS zillow_apify_sync_profiles_updated_at ON public.zillow_apify_sync_profiles;
CREATE TRIGGER zillow_apify_sync_profiles_updated_at
  BEFORE UPDATE ON public.zillow_apify_sync_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. zillow_apify_sync_runs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zillow_apify_sync_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL REFERENCES public.zillow_apify_sync_profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'partial', 'paused', 'stopped')),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  listings_scraped    INT NOT NULL DEFAULT 0,
  agents_upserted     INT NOT NULL DEFAULT 0,
  error_message       TEXT,
  -- Keys: apify_search_run_id, apify_agent_run_ids[], phase, batch
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_zillow_sync_runs_profile
  ON public.zillow_apify_sync_runs(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sync_runs_status
  ON public.zillow_apify_sync_runs(status) WHERE status IN ('running', 'partial', 'paused');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. zillow_listing_staging
-- Per-property rows from the search actor. Also queued for agent enrichment.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zillow_listing_staging (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id       UUID NOT NULL REFERENCES public.zillow_apify_sync_runs(id) ON DELETE CASCADE,
  zpid              TEXT NOT NULL,
  detail_url        TEXT NOT NULL,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  zipcode           TEXT,
  list_price        NUMERIC,
  days_on_market    INT,
  broker_name       TEXT,
  search_raw        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Filled in during Phase B enrichment
  agent_enriched_at TIMESTAMPTZ,

  UNIQUE (sync_run_id, zpid)
);

CREATE INDEX IF NOT EXISTS idx_zillow_staging_run
  ON public.zillow_listing_staging(sync_run_id, agent_enriched_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_zillow_staging_zpid
  ON public.zillow_listing_staging(zpid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. zillow_agent_leads
-- Agent-primary dedup table. One row per unique listing agent (by phone).
-- Mirrors mls_agent_leads structure for UI parity but has no FK to Bridge.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zillow_agent_leads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              UUID NOT NULL REFERENCES public.zillow_apify_sync_profiles(id) ON DELETE CASCADE,
  dataset_id              TEXT NOT NULL DEFAULT 'zillow-apify',

  -- "zillow-agent:{digitsOnly}" or "zillow-agent:name:{slug}" when no phone
  external_id             TEXT NOT NULL UNIQUE,

  -- Agent contact (from agent actor)
  agent_name              TEXT NOT NULL DEFAULT '',
  agent_phone             TEXT NOT NULL DEFAULT '',
  agent_email             TEXT NOT NULL DEFAULT '',
  brokerage               TEXT NOT NULL DEFAULT '',
  broker_phone            TEXT NOT NULL DEFAULT '',
  mls_name                TEXT NOT NULL DEFAULT '',
  is_listed_by_owner      BOOLEAN NOT NULL DEFAULT false,
  true_status             TEXT,

  -- Latest property rollup
  listing_count           INT  NOT NULL DEFAULT 1,
  latest_zpid             TEXT,
  latest_detail_url       TEXT,
  latest_property_address TEXT,
  latest_city             TEXT,
  latest_state            TEXT,
  latest_list_price       NUMERIC,
  latest_days_on_market   INT,

  -- Workflow (same values as mls_agent_leads)
  status                  TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New', 'Contacted', 'Partnered', 'Closed Won', 'Declined')),
  assigned_rep            TEXT,
  last_contact_at         TIMESTAMPTZ,
  notes                   TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zillow_agent_leads_profile
  ON public.zillow_agent_leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_zillow_agent_leads_status
  ON public.zillow_agent_leads(status);
CREATE INDEX IF NOT EXISTS idx_zillow_agent_leads_state
  ON public.zillow_agent_leads(latest_state);
CREATE INDEX IF NOT EXISTS idx_zillow_agent_leads_assigned_rep
  ON public.zillow_agent_leads(assigned_rep) WHERE assigned_rep IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zillow_agent_leads_unassigned
  ON public.zillow_agent_leads(created_at) WHERE assigned_rep IS NULL;
CREATE INDEX IF NOT EXISTS idx_zillow_agent_leads_updated
  ON public.zillow_agent_leads(updated_at DESC);

DROP TRIGGER IF EXISTS zillow_agent_leads_updated_at ON public.zillow_agent_leads;
CREATE TRIGGER zillow_agent_leads_updated_at
  BEFORE UPDATE ON public.zillow_agent_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Round-robin state row for Zillow channel
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.inventory_round_robin_state (scope, next_index)
VALUES ('zillow_apify', 0)
ON CONFLICT (scope) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS — deny direct access; Edge Functions use service role
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.zillow_apify_sync_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zillow_apify_sync_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zillow_listing_staging     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zillow_agent_leads         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'zillow_apify_sync_profiles',
    'zillow_apify_sync_runs',
    'zillow_listing_staging',
    'zillow_agent_leads'
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
