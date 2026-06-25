import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getStoredToken } from './auth';
import type { AuctionSyncStateConfig } from '@/config/auctionStates';

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuctionSyncRun {
  id: string;
  status: 'running' | 'success' | 'failed' | 'partial' | 'paused' | 'stopped';
  started_at: string;
  completed_at: string | null;
  listings_scraped: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface AuctionListing {
  id: string;
  auction_id: string;
  sync_run_id: string | null;
  url: string | null;
  address: string | null;
  state: string | null;
  county: string | null;
  municipality: string | null;
  postal_code: string | null;
  street_description: string | null;
  latitude: number | null;
  longitude: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_sqft: number | null;
  year_built: number | null;
  property_type: string | null;
  property_type_group: string | null;
  sale_type: string | null;
  opening_bid: number | null;
  starting_bid_amount: number | null;
  auction_start_date: string | null;
  auction_end_date: string | null;
  auction_date: string | null;
  auction_time: string | null;
  auction_location: string | null;
  status: string | null;
  occupancy_status: string | null;
  buyer_premium_available: boolean;
  interior_access_allowed: boolean;
  is_first_look_enabled: boolean;
  is_direct_offer_enabled: boolean;
  primary_photo_url: string | null;
  last_scraped_at: string;
  created_at: string;
}

export interface AuctionSyncStatus {
  recentRuns: AuctionSyncRun[];
  totalListings: number;
  activeRun: AuctionSyncRun | null;
  syncInProgress: boolean;
  activeAuctionsOnly?: boolean;
}

// ─── Sync controls ────────────────────────────────────────────────────────────

export async function startAuctionSync(
  config: AuctionSyncStateConfig = { stateMode: 'all' },
): Promise<{ runId?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auction-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({
        action: 'sync',
        stateMode: config.stateMode,
        ...(config.stateMode === 'count' ? { stateCount: config.stateCount } : {}),
        ...(config.stateMode === 'selected' ? { states: config.states } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return { runId: data.runId };
  } catch {
    return { error: 'Network error' };
  }
}

export async function collectAuctionRun(
  runId: string,
): Promise<{
  done?: boolean;
  processedStates?: number;
  pendingStates?: number;
  listingsScraped?: number;
  activeState?: string | null;
  runStatus?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/auction-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'collect', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return {
      done: data.done,
      processedStates: data.processedStates,
      pendingStates: data.pendingStates,
      listingsScraped: data.listingsScraped,
      activeState: data.activeState,
      runStatus: data.runStatus,
    };
  } catch {
    return { error: 'Network error' };
  }
}

export async function stopAuctionSync(
  runId: string,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auction-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'stop', runId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}

export async function fetchAuctionSyncStatus(): Promise<AuctionSyncStatus & { error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auction-apify-sync`, {
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        recentRuns: [],
        totalListings: 0,
        activeRun: null,
        syncInProgress: false,
        error: data.error,
      };
    }
    return {
      recentRuns: data.recentRuns ?? [],
      totalListings: data.totalListings ?? 0,
      activeRun: data.activeRun ?? null,
      syncInProgress: data.syncInProgress ?? false,
      activeAuctionsOnly: data.activeAuctionsOnly,
    };
  } catch {
    return {
      recentRuns: [],
      totalListings: 0,
      activeRun: null,
      syncInProgress: false,
      error: 'Network error',
    };
  }
}

export async function listAuctionSyncRuns(): Promise<{ runs: AuctionSyncRun[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auction-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'list' }),
    });
    const data = await res.json();
    if (!res.ok) return { runs: [], error: data.error };
    return { runs: data.runs ?? [] };
  } catch {
    return { runs: [], error: 'Network error' };
  }
}

export interface FetchAuctionListingsOptions {
  state?: string;
  saleType?: string;
  sort?: 'auction_date_desc' | 'bid_asc' | 'bid_desc';
  limit?: number;
  offset?: number;
}

export async function fetchAuctionListings(
  opts: FetchAuctionListingsOptions = {},
): Promise<{ listings: AuctionListing[]; total: number; activeAuctionsOnly?: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auction-apify-sync`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({
        action: 'listings',
        state: opts.state,
        saleType: opts.saleType,
        sort: opts.sort ?? 'auction_date_desc',
        limit: opts.limit ?? 50,
        offset: opts.offset ?? 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { listings: [], total: 0, error: data.error };
    return {
      listings: data.listings ?? [],
      total: data.total ?? 0,
      activeAuctionsOnly: data.activeAuctionsOnly,
    };
  } catch {
    return { listings: [], total: 0, error: 'Network error' };
  }
}
