import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from '@/services/auth';
import { realtorLeads, type RealtorLead } from '@/data/realtorLeads';

export interface ZillowHealth {
  status: 'healthy' | 'pending';
  lastSync: string;
  newToday: number;
  totalActive: number;
  statesCovered: number;
  keywordsTracked: string[];
}

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

export async function getZillowHealth(): Promise<ZillowHealth> {
  return {
    status: 'pending',
    lastSync: 'Configure API key in Integrations to enable live sync',
    newToday: 0,
    totalActive: 0,
    statesCovered: 0,
    keywordsTracked: ['short sale'],
  };
}

export async function searchShortSaleListings(state?: string): Promise<RealtorLead[]> {
  try {
    const url = new URL(`${SUPABASE_URL}/functions/v1/zillow-sync`);
    if (state) url.searchParams.set('state', state);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: authedHeaders(),
    });

    if (!res.ok) {
      // Integration not configured or not connected — fall back to mock data
      console.warn('[zillow] sync unavailable, using mock data', { status: res.status });
      return filterMock(state);
    }

    const data = await res.json() as { leads?: RealtorLead[] };
    return data.leads || [];
  } catch {
    return filterMock(state);
  }
}

function filterMock(state?: string): RealtorLead[] {
  if (!state) return realtorLeads;
  return realtorLeads.filter((l) => l.state === state);
}
