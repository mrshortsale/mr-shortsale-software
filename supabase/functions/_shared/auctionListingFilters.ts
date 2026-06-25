/**
 * Auction.com listing ingest + query filters.
 */

export const AUCTION_LISTING_WINDOW_DAYS = 7;

export function isBankOwnedSaleType(saleType: string | null | undefined): boolean {
  return (saleType ?? "").toLowerCase().replace(/-/g, " ").includes("bank owned");
}

export function listingWindowCutoffIso(days = AUCTION_LISTING_WINDOW_DAYS): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function isWithinListingWindow(
  auctionStartDate: string | null | undefined,
  days = AUCTION_LISTING_WINDOW_DAYS,
): boolean {
  if (!auctionStartDate) return false;
  const listedAt = new Date(auctionStartDate);
  if (Number.isNaN(listedAt.getTime())) return false;
  return listedAt.getTime() >= new Date(listingWindowCutoffIso(days)).getTime();
}

export interface AuctionIngestFilterStats {
  input: number;
  kept: number;
  skippedBankOwned: number;
  skippedOutsideWindow: number;
  skippedDuplicate: number;
  skippedMissingId: number;
}

/** Dedup by auction id; drop bank-owned and listings older than the window. */
export function filterAuctionItemsForIngest<T extends {
  id?: string | number;
  saleType?: string;
  auction_start_date?: string | null;
}>(
  items: T[],
  days = AUCTION_LISTING_WINDOW_DAYS,
): { items: T[]; stats: AuctionIngestFilterStats } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const stats: AuctionIngestFilterStats = {
    input: items.length,
    kept: 0,
    skippedBankOwned: 0,
    skippedOutsideWindow: 0,
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
    if (!isWithinListingWindow(item.auction_start_date, days)) {
      stats.skippedOutsideWindow++;
      continue;
    }
    seen.add(auctionId);
    kept.push(item);
    stats.kept++;
  }

  return { items: kept, stats };
}
