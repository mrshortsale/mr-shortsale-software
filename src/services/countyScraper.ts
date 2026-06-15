import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { getStoredToken } from '@/services/auth';
import type {
  CountyScrapeRun,
  CountySource,
  CreateCountySourceInput,
} from '@/types/countyScraper';

const COUNTY_SOURCES_URL = `${SUPABASE_URL}/functions/v1/county-sources-manage`;
const COUNTY_SYNC_URL = `${SUPABASE_URL}/functions/v1/county-scraper-sync`;

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function requireOk<T extends { error?: string }>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await parseJson<T>(response);
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

export async function getCountySources(): Promise<CountySource[]> {
  const response = await fetch(COUNTY_SOURCES_URL, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const data = await requireOk<{ sources: CountySource[]; error?: string }>(
    response,
    'Failed to load county sources',
  );
  return data.sources;
}

export async function createCountySource(input: CreateCountySourceInput): Promise<CountySource> {
  const response = await fetch(COUNTY_SOURCES_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'create', ...input }),
  });
  const data = await requireOk<{ source: CountySource; error?: string }>(
    response,
    'Failed to create county source',
  );
  return data.source;
}

export async function updateCountySource(
  id: string,
  updates: Partial<CountySource>,
): Promise<CountySource> {
  const response = await fetch(COUNTY_SOURCES_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'update', id, ...updates }),
  });
  const data = await requireOk<{ source: CountySource; error?: string }>(
    response,
    'Failed to update county source',
  );
  return data.source;
}

export async function deleteCountySource(id: string): Promise<void> {
  const response = await fetch(COUNTY_SOURCES_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'delete', id }),
  });
  await requireOk<{ ok: boolean; error?: string }>(response, 'Failed to delete county source');
}

export async function toggleCountySourceActive(id: string, isActive: boolean): Promise<void> {
  await updateCountySource(id, { is_active: isActive });
}

export async function runCountyScrape(countySourceId: string): Promise<CountyScrapeRun> {
  const response = await fetch(COUNTY_SYNC_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ county_source_id: countySourceId }),
  });
  const data = await requireOk<{ run: CountyScrapeRun; error?: string }>(response, 'Scrape failed');
  return data.run;
}

export async function getScrapeRuns(countySourceId?: string): Promise<CountyScrapeRun[]> {
  const params = new URLSearchParams({ action: 'runs' });
  if (countySourceId) params.set('county_source_id', countySourceId);

  const response = await fetch(`${COUNTY_SOURCES_URL}?${params.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const data = await requireOk<{ runs: CountyScrapeRun[]; error?: string }>(
    response,
    'Failed to load runs',
  );
  return data.runs;
}
