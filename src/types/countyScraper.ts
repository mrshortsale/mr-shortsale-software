export interface CountySource {
  id: string;
  name: string;
  state: string;
  county_fips: string | null;
  scrape_url: string;
  scrape_method: 'firecrawl' | 'apify';
  apify_actor_id: string | null;
  url_params: Record<string, string> | null;
  is_active: boolean;
  schedule: 'daily' | 'manual';
  last_scraped_at: string | null;
  last_record_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CountyScrapeRun {
  id: string;
  county_source_id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  started_at: string;
  completed_at: string | null;
  records_found: number;
  records_inserted: number;
  records_skipped: number;
  error_message: string | null;
  raw_preview: string | null;
  county_sources?: { name: string; state: string } | null;
}

export type CreateCountySourceInput = Pick<CountySource, 'name' | 'state' | 'scrape_url' | 'scrape_method' | 'schedule'> &
  Partial<Pick<CountySource, 'county_fips' | 'apify_actor_id' | 'url_params' | 'notes' | 'is_active'>>;
