-- County scraper data sources
CREATE TABLE IF NOT EXISTS public.county_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'FL',
  county_fips TEXT,
  scrape_url TEXT NOT NULL,
  scrape_method TEXT NOT NULL DEFAULT 'firecrawl' CHECK (scrape_method IN ('firecrawl', 'apify')),
  apify_actor_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  schedule TEXT NOT NULL DEFAULT 'daily' CHECK (schedule IN ('daily', 'manual')),
  last_scraped_at TIMESTAMPTZ,
  last_record_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.county_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_source_id UUID NOT NULL REFERENCES public.county_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','stopped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_found INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  raw_preview TEXT,
  sample_records JSONB
);

ALTER TABLE public.inventory_leads ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'BatchLeads';
ALTER TABLE public.inventory_leads ADD COLUMN IF NOT EXISTS data_source_primary TEXT;
ALTER TABLE public.inventory_leads ALTER COLUMN external_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION update_county_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS county_sources_updated_at ON public.county_sources;
CREATE TRIGGER county_sources_updated_at
  BEFORE UPDATE ON public.county_sources
  FOR EACH ROW EXECUTE FUNCTION update_county_sources_updated_at();

CREATE INDEX IF NOT EXISTS idx_county_sources_active_schedule ON public.county_sources(is_active, schedule);
CREATE INDEX IF NOT EXISTS idx_county_scrape_runs_source_started ON public.county_scrape_runs(county_source_id, started_at DESC);

INSERT INTO public.county_sources (name, state, county_fips, scrape_url, scrape_method, notes)
VALUES ('Miami-Dade', 'FL', '12086', 'https://www2.miamidadeclerk.gov/ocs/Search.aspx', 'firecrawl', 'Lis pendens tool. Filter by document type LIS PENDENS. If page requires form interaction, switch to apify.')
ON CONFLICT DO NOTHING;
