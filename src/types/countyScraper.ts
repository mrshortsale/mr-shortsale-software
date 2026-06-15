export type ScrapeMethod = 'firecrawl' | 'apify';
export type ScrapeSchedule = 'daily' | 'manual';
export type ScrapeRunStatus = 'running' | 'completed' | 'failed' | 'stopped';

export interface CountySource {
  id: string;
  name: string;
  state: string;
  county_fips: string | null;
  scrape_url: string;
  scrape_method: ScrapeMethod;
  apify_actor_id: string | null;
  is_active: boolean;
  schedule: ScrapeSchedule;
  last_scraped_at: string | null;
  last_record_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CountyLeadExtractionRecord {
  homeowner_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  filing_type: string;
  filing_date: string | null;
  case_number: string;
  mortgage_lender: string | null;
  attorney_name: string | null;
  amount_owed: number | null;
  parcel_id: string | null;
}

export interface CountySampleRecord {
  homeowner_name?: string;
  address?: string;
  filing_date?: string | null;
  urgency_score?: number;
  [key: string]: unknown;
}

export interface CountyScrapeRun {
  id: string;
  county_source_id: string;
  status: ScrapeRunStatus;
  started_at: string;
  completed_at: string | null;
  records_found: number;
  records_inserted: number;
  records_skipped: number;
  error_message: string | null;
  raw_preview: string | null;
  sample_records: CountySampleRecord[] | null;
  county_sources?: { name: string };
}

export interface CreateCountySourceInput {
  name: string;
  state: string;
  county_fips?: string;
  scrape_url: string;
  scrape_method: ScrapeMethod;
  apify_actor_id?: string;
  schedule: ScrapeSchedule;
  notes?: string;
}
