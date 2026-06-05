-- Dynamic Bridge MLS integration: profiles, raw property store, agent-primary leads, sync runs

-- ─────────────────────────────────────────────────────────────────────────────
-- bridge_mls_sync_profiles
-- One row per MLS dataset (e.g. actris_ref, onekey).
-- All sync-query config lives here; token stays in integration_credentials.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bridge_mls_sync_profiles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id         UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  dataset_id             TEXT NOT NULL,
  display_name           TEXT NOT NULL,
  enabled                BOOLEAN NOT NULL DEFAULT false,

  -- Query filters (preset builder)
  state_allowlist        TEXT[]   NOT NULL DEFAULT '{}',
  keyword_filters        TEXT[]   NOT NULL DEFAULT ARRAY['short sale','shortsale'],
  condition_filters      TEXT[]   NOT NULL DEFAULT ARRAY[
    'Pre-Foreclosure','In Foreclosure','Bankruptcy Property',
    'Short Sale','Notice Of Default'
  ],
  -- When non-empty this replaces the preset builder entirely (advanced override)
  odata_filter_override  TEXT,

  -- OData request params
  select_fields          TEXT[]   NOT NULL DEFAULT ARRAY[
    'ListingId','BridgeModificationTimestamp','ListAgentKey','ListAgentFullName',
    'ListOfficeName','ListAgentDirectPhone','ListAgentEmail',
    'UnparsedAddress','City','StateOrProvince','ListPrice',
    'DaysOnMarket','PriceChangeTimestamp','PublicRemarks','SpecialListingConditions'
  ],
  page_size              INT      NOT NULL DEFAULT 200,
  sort_order             TEXT     NOT NULL DEFAULT 'DaysOnMarket desc',

  -- Per-profile test state
  last_tested_at         TIMESTAMPTZ,
  last_test_status       TEXT CHECK (last_test_status IN ('success', 'failure')),
  last_test_error        TEXT,

  -- Watermark for incremental sync
  last_synced_at         TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (integration_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_profiles_integration
  ON public.bridge_mls_sync_profiles(integration_id);
CREATE INDEX IF NOT EXISTS idx_bridge_profiles_enabled
  ON public.bridge_mls_sync_profiles(enabled) WHERE enabled = true;

DROP TRIGGER IF EXISTS bridge_mls_sync_profiles_set_updated_at ON public.bridge_mls_sync_profiles;
CREATE TRIGGER bridge_mls_sync_profiles_set_updated_at
  BEFORE UPDATE ON public.bridge_mls_sync_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- bridge_property_raw
-- Full OData Property payload per listing, kept for audit / reprocessing.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bridge_property_raw (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID NOT NULL REFERENCES public.bridge_mls_sync_profiles(id) ON DELETE CASCADE,
  listing_id       TEXT NOT NULL,
  list_agent_key   TEXT,
  raw_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (profile_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_raw_profile
  ON public.bridge_property_raw(profile_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_raw_agent_key
  ON public.bridge_property_raw(list_agent_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- mls_agent_leads
-- Agent-primary dedup table: one row per (dataset_id, list_agent_key).
-- listing_count and latest_* are updated on every sync.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mls_agent_leads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id               UUID NOT NULL REFERENCES public.bridge_mls_sync_profiles(id) ON DELETE CASCADE,
  dataset_id               TEXT NOT NULL,
  external_id              TEXT NOT NULL,   -- "{dataset_id}:{list_agent_key}"

  -- Agent identity
  list_agent_key           TEXT,
  agent_name               TEXT NOT NULL DEFAULT '',
  brokerage                TEXT NOT NULL DEFAULT '',
  agent_phone              TEXT NOT NULL DEFAULT '',
  agent_email              TEXT NOT NULL DEFAULT '',
  language                 TEXT NOT NULL DEFAULT 'EN' CHECK (language IN ('EN', 'ES')),

  -- Aggregate rollups (updated on each sync)
  listing_count            INT  NOT NULL DEFAULT 1,
  latest_listing_id        TEXT,
  latest_property_address  TEXT,
  latest_city              TEXT,
  latest_state             TEXT,
  latest_list_price        NUMERIC,
  latest_days_on_market    INT,
  latest_public_remarks    TEXT,

  -- Workflow
  status                   TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New', 'Contacted', 'Partnered', 'Closed Won', 'Declined')),
  last_contact_at          TIMESTAMPTZ,
  notes                    TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (dataset_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_profile
  ON public.mls_agent_leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_dataset
  ON public.mls_agent_leads(dataset_id);
CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_status
  ON public.mls_agent_leads(status);
CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_state
  ON public.mls_agent_leads(latest_state);
CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_updated
  ON public.mls_agent_leads(updated_at DESC);

DROP TRIGGER IF EXISTS mls_agent_leads_set_updated_at ON public.mls_agent_leads;
CREATE TRIGGER mls_agent_leads_set_updated_at
  BEFORE UPDATE ON public.mls_agent_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- realtor_sync_runs
-- Mirrors inventory_sync_runs but scoped to a bridge profile.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.realtor_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES public.bridge_mls_sync_profiles(id) ON DELETE CASCADE,
  dataset_id      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'partial', 'paused', 'stopped')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  leads_upserted  INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_realtor_sync_runs_profile
  ON public.realtor_sync_runs(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_sync_runs_status
  ON public.realtor_sync_runs(status) WHERE status IN ('running', 'partial', 'paused');

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — deny direct access; Edge Functions use service role
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bridge_mls_sync_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_property_raw      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mls_agent_leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtor_sync_runs        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bridge_mls_sync_profiles',
    'bridge_property_raw',
    'mls_agent_leads',
    'realtor_sync_runs'
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
-- Seed: ACTRIS (Austin Board of Realtors) — disabled until CEO tests + enables
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.bridge_mls_sync_profiles (
  integration_id, dataset_id, display_name, enabled
)
SELECT
  id,
  'actris_ref',
  'ACTRIS (Austin, TX)',
  false
FROM public.integrations
WHERE slug = 'zillow'
ON CONFLICT (integration_id, dataset_id) DO NOTHING;
