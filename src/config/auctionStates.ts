/** US states passed to the Auction.com Apify actor as search_term values. */
export const AUCTION_US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming', 'Washington DC',
] as const;

export type AuctionStateMode = 'all' | 'count' | 'selected';

export interface AuctionSyncStateConfig {
  stateMode: AuctionStateMode;
  stateCount?: number;
  states?: string[];
}

export function resolveAuctionSyncStates(config: AuctionSyncStateConfig): string[] {
  if (config.stateMode === 'selected' && config.states?.length) {
    const valid = config.states.filter((s) =>
      (AUCTION_US_STATES as readonly string[]).includes(s),
    );
    if (valid.length > 0) return valid;
  }

  if (config.stateMode === 'count' && config.stateCount && config.stateCount > 0) {
    return [...AUCTION_US_STATES].slice(
      0,
      Math.min(config.stateCount, AUCTION_US_STATES.length),
    );
  }

  return [...AUCTION_US_STATES];
}
