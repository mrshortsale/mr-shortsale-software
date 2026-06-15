import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from '@/services/auth';
import type { CountySource, CountyScrapeRun, CreateCountySourceInput } from '@/types/countyScraper';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;

function getAuthHeaders() {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    'x-auth-token': token || '',
  };
}

export async function getCountySources(): Promise<CountySource[]> {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'GET', headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load county sources');
  return data.sources;
}

export async function createCountySource(input: CreateCountySourceInput): Promise<CountySource> {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'create', ...input }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create county source');
  return data.source;
}

export async function updateCountySource(id: string, updates: Partial<CountySource>): Promise<CountySource> {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'update', id, ...updates }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update county source');
  return data.source;
}

export async function deleteCountySource(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/county-sources-manage`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'delete', id }) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete county source');
  }
}

export async function toggleCountySourceActive(id: string, is_active: boolean): Promise<void> {
  await updateCountySource(id, { is_active });
}

export async function runCountyScrape(countySourceId: string): Promise<CountyScrapeRun> {
  const res = await fetch(`${BASE_URL}/county-scraper-sync`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ county_source_id: countySourceId }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Scrape failed');
  return data.run;
}

export async function getScrapeRuns(countySourceId?: string): Promise<CountyScrapeRun[]> {
  const params = new URLSearchParams({ action: 'runs' });
  if (countySourceId) params.set('county_source_id', countySourceId);
  const res = await fetch(`${BASE_URL}/county-sources-manage?${params}`, { headers: getAuthHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load runs');
  return data.runs;
}
