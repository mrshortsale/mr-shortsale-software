/**
 * Auction.com listing ingest + query filters.
 */

/** Grace after start for single-day / live auctions with no end date. */
export const ACTIVE_AUCTION_NO_END_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

export function isBankOwnedSaleType(saleType: string | null | undefined): boolean {
  return (saleType ?? "").toLowerCase().replace(/-/g, " ").includes("bank owned");
}

/**
 * Listing is still active on Auction.com when:
 * - auction_end_date is in the future (or now), or
 * - auction_end_date is missing and auction_start_date is upcoming / within grace window.
 */
export function isActiveAuctionListing(
  auctionStartDate: string | null | undefined,
  auctionEndDate: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (auctionEndDate) {
    const end = new Date(auctionEndDate);
    if (!Number.isNaN(end.getTime())) {
      return end.getTime() >= nowMs;
    }
  }

  if (auctionStartDate) {
    const start = new Date(auctionStartDate);
    if (Number.isNaN(start.getTime())) return false;
    return start.getTime() + ACTIVE_AUCTION_NO_END_GRACE_MS >= nowMs;
  }

  return false;
}

export function activeAuctionNoEndCutoffIso(
  nowMs = Date.now(),
): string {
  return new Date(nowMs - ACTIVE_AUCTION_NO_END_GRACE_MS).toISOString();
}

export interface AuctionIngestFilterStats {
  input: number;
  kept: number;
  skippedBankOwned: number;
  skippedInactive: number;
  skippedDuplicate: number;
  skippedMissingId: number;
}

/** Dedup by auction id; drop bank-owned and ended auctions. */
export function filterAuctionItemsForIngest<T extends {
  id?: string | number;
  saleType?: string;
  auction_start_date?: string | null;
  auction_end_date?: string | null;
}>(
  items: T[],
): { items: T[]; stats: AuctionIngestFilterStats } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const stats: AuctionIngestFilterStats = {
    input: items.length,
    kept: 0,
    skippedBankOwned: 0,
    skippedInactive: 0,
    skippedDuplicate: 0,
    skippedMissingId: 0,
  };

  for (const item of items) {
    const auctionId = String(item.id ?? "").trim();
    if (!auctionId) {
      stats.skippedMissingId++;
      continue;
    }
    if (seen.has(auctionId)) {
      stats.skippedDuplicate++;
      continue;
    }
    if (isBankOwnedSaleType(item.saleType)) {
      stats.skippedBankOwned++;
      continue;
    }
    if (!isActiveAuctionListing(item.auction_start_date, item.auction_end_date)) {
      stats.skippedInactive++;
      continue;
    }
    seen.add(auctionId);
    kept.push(item);
    stats.kept++;
  }

  return { items: kept, stats };
}
