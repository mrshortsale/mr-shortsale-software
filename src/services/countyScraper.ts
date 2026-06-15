import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';
import type { CountyScrapeRun, CountySource, CreateCountySourceInput } from '@/types/countyScraper';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data as T;
}

export const getCountySources = async (): Promise<CountySource[]> => {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { headers: authedHeaders() });
  const data = await parseResponse<{ countySources: CountySource[] }>(res, 'Failed to fetch county sources');
  return data.countySources;
};

export const createCountySource = async (data: CreateCountySourceInput): Promise<CountySource> => {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: authedHeaders(), body: JSON.stringify({ action: 'create', data }) });
  return (await parseResponse<{ countySource: CountySource }>(res, 'Failed to create county source')).countySource;
};

export const updateCountySource = async (id: string, data: Partial<CountySource>): Promise<CountySource> => {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: authedHeaders(), body: JSON.stringify({ action: 'update', id, data }) });
  return (await parseResponse<{ countySource: CountySource }>(res, 'Failed to update county source')).countySource;
};

export const deleteCountySource = async (id: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: authedHeaders(), body: JSON.stringify({ action: 'delete', id }) });
  await parseResponse(res, 'Failed to delete county source');
};

export const toggleCountySourceActive = async (id: string, isActive: boolean): Promise<void> => {
  await updateCountySource(id, { is_active: isActive });
};

export const runCountyScrape = async (countySourceId: string): Promise<CountyScrapeRun> => {
  const res = await fetch(`${BASE_URL}/county-scraper-sync`, { method: 'POST', headers: authedHeaders(), body: JSON.stringify({ county_source_id: countySourceId }) });
  const data = await parseResponse<{ runId: string }>(res, 'Failed to run county scrape');
  const runs = await getCountyScrapeRuns(countySourceId);
  return runs.find((run) => run.id === data.runId) ?? runs[0];
};

export const getCountyScrapeRuns = async (countySourceId?: string): Promise<CountyScrapeRun[]> => {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: authedHeaders(), body: JSON.stringify({ action: 'runs', countySourceId }) });
  const data = await parseResponse<{ runs: CountyScrapeRun[] }>(res, 'Failed to fetch county scrape runs');
  return data.runs;
};
