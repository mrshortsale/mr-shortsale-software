CREATE TABLE IF NOT EXISTS public.county_sources (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  state           TEXT        NOT NULL DEFAULT 'FL',
  county_fips     TEXT,
  scrape_url      TEXT        NOT NULL,
  scrape_method   TEXT        NOT NULL DEFAULT 'firecrawl'
                              CHECK (scrape_method IN ('firecrawl', 'apify')),
  apify_actor_id  TEXT,
  url_params      JSONB,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  schedule        TEXT        NOT NULL DEFAULT 'daily' CHECK (schedule IN ('daily', 'manual')),
  last_scraped_at TIMESTAMPTZ,
  last_record_count INTEGER   DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.county_sources TO service_role;

CREATE TABLE IF NOT EXISTS public.county_scrape_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  county_source_id  UUID        REFERENCES public.county_sources(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'running'
                                CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  records_found     INTEGER     DEFAULT 0,
  records_inserted  INTEGER     DEFAULT 0,
  records_skipped   INTEGER     DEFAULT 0,
  error_message     TEXT,
  raw_preview       TEXT
);

GRANT ALL ON public.county_scrape_runs TO service_role;

CREATE INDEX IF NOT EXISTS idx_county_sources_active_schedule
  ON public.county_sources(is_active, schedule);
CREATE INDEX IF NOT EXISTS idx_county_scrape_runs_source_started
  ON public.county_scrape_runs(county_source_id, started_at DESC);

ALTER TABLE public.county_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.county_scrape_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'county_sources' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE 'CREATE POLICY "deny_all_direct_access" ON public.county_sources AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'county_scrape_runs' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE 'CREATE POLICY "deny_all_direct_access" ON public.county_scrape_runs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)';
  END IF;
END
$$;

INSERT INTO public.county_sources (name, state, county_fips, scrape_url, scrape_method, notes)
SELECT 'Miami-Dade',
       'FL',
       '12086',
       'https://www2.miamidadeclerk.gov/ocs/Search.aspx',
       'firecrawl',
       'Official Records search. Lis pendens tool: https://www2.miamidadeclerk.gov/ocs/Search.aspx - search by document type LIS PENDENS, date range = today'
WHERE NOT EXISTS (
  SELECT 1 FROM public.county_sources WHERE name = 'Miami-Dade' AND state = 'FL'
);