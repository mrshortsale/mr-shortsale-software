// Zillow keyword-listing search (mock).
// Real plan: scrape Zillow's listing search by keyword="short sale" + state filter,
// then enrich with the listing agent's contact info from public profile pages.
// Real wiring deferred — UI uses mock seed data.

import { realtorLeads, RealtorLead } from '@/data/realtorLeads';

export interface ZillowHealth {
  status: 'healthy' | 'pending';
  lastSync: string;
  newToday: number;
  totalActive: number;
  statesCovered: number;
  keywordsTracked: string[];
}

export async function getZillowHealth(): Promise<ZillowHealth> {
  return {
    status: 'pending',
    lastSync: 'API key pending — UI active with sample data',
    newToday: 7,
    totalActive: realtorLeads.length,
    statesCovered: 3,
    keywordsTracked: ['short sale'],
  };
}

export async function searchShortSaleListings(state?: string, keyword = 'short sale'): Promise<RealtorLead[]> {
  let list = realtorLeads;
  if (state) list = list.filter(l => l.state === state);
  // keyword filter is a no-op in mock; placeholder for real integration
  void keyword;
  return list;
}
