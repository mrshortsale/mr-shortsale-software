import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Filter, RefreshCw, Loader2,
  ExternalLink, Home, MapPin, Calendar, DollarSign, Gavel,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import TablePagination from '@/components/shared/TablePagination';
import {
  fetchAuctionListings,
  fetchAuctionSyncStatus,
  type AuctionListing,
} from '@/services/auctionApify';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SALE_TYPE_BADGE: Record<string, string> = {
  'Foreclosure':       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Private Seller':    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Newly Foreclosed':  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

function saleTypeBadge(saleType: string | null) {
  const cls = SALE_TYPE_BADGE[saleType ?? ''] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {saleType ?? '—'}
    </span>
  );
}

function fmtBid(v: number | null) {
  if (v == null || v <= 1) return v === 1 ? '$1 (TBD)' : '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const US_STATE_ABBRS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function ListingDrawer({
  listing,
  onClose,
}: {
  listing: AuctionListing;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-card border-l shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-snug">
                {listing.street_description || listing.address || 'Unknown Address'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[listing.municipality, listing.state, listing.postal_code].filter(Boolean).join(', ')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xl leading-none shrink-0"
            >
              &times;
            </button>
          </div>

          {/* Photo */}
          {listing.primary_photo_url && (
            <img
              src={listing.primary_photo_url}
              alt="Property"
              className="w-full rounded-md object-cover h-44"
            />
          )}

          {/* Sale info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted/40 p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sale Type</p>
              <div>{saleTypeBadge(listing.sale_type)}</div>
            </div>
            <div className="rounded-md bg-muted/40 p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Opening Bid</p>
              <p className="text-sm font-semibold">{fmtBid(listing.opening_bid ?? listing.starting_bid_amount)}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Auction Date</p>
              <p className="text-sm">{listing.auction_date ?? fmtDate(listing.auction_start_date)}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Location</p>
              <p className="text-sm">{listing.auction_location ?? '—'}</p>
            </div>
          </div>

          {/* Property details */}
          <div className="rounded-md bg-muted/40 p-3 space-y-1.5 text-sm">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Property</p>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              {listing.property_type && (
                <><span className="text-muted-foreground">Type</span><span>{listing.property_type.replace(/_/g, ' ')}</span></>
              )}
              {listing.beds != null && (
                <><span className="text-muted-foreground">Beds</span><span>{listing.beds}</span></>
              )}
              {listing.baths != null && (
                <><span className="text-muted-foreground">Baths</span><span>{listing.baths}</span></>
              )}
              {listing.sqft != null && (
                <><span className="text-muted-foreground">Sqft</span><span>{listing.sqft?.toLocaleString()}</span></>
              )}
              {listing.year_built != null && (
                <><span className="text-muted-foreground">Year Built</span><span>{listing.year_built}</span></>
              )}
              {listing.occupancy_status && (
                <><span className="text-muted-foreground">Occupancy</span><span className="capitalize">{listing.occupancy_status.toLowerCase()}</span></>
              )}
              {listing.county && (
                <><span className="text-muted-foreground">County</span><span>{listing.county}</span></>
              )}
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-1.5">
            {listing.buyer_premium_available && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Buyer Premium</span>
            )}
            {listing.interior_access_allowed && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Interior Access</span>
            )}
            {listing.is_first_look_enabled && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">First Look</span>
            )}
          </div>

          {/* Last scraped */}
          <p className="text-[10px] text-muted-foreground">
            Last scraped: {fmtDate(listing.last_scraped_at)} · ID: {listing.auction_id}
          </p>

          {/* External link */}
          {listing.url && (
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              View on Auction.com <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type SortKey = 'auction_date_desc' | 'bid_asc' | 'bid_desc';

export default function AuctionListingsPage() {
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filterState, setFilterState] = useState('');
  const [filterSaleType, setFilterSaleType] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('auction_date_desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drawer, setDrawer] = useState<AuctionListing | null>(null);
  const [totalListings, setTotalListings] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load total count once
  useEffect(() => {
    fetchAuctionSyncStatus().then((s) => setTotalListings(s.totalListings));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { listings: l, total: t } = await fetchAuctionListings({
      state: filterState || undefined,
      saleType: filterSaleType || undefined,
      q: debouncedSearch || undefined,
      sort: sortKey,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    setLoading(false);
    setListings(l);
    setTotal(t);
  }, [filterState, filterSaleType, page, pageSize, debouncedSearch, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [filterState, filterSaleType, debouncedSearch, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auction Listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active foreclosure and private-seller auctions (newest listed first). Bank Owned excluded.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-sm">
          {totalListings.toLocaleString()} total listings
        </Badge>
      </div>

      {/* Filter bar */}
      <div className="metric-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <Input
            className="h-7 text-xs w-44"
            placeholder="Search address, city, ZIP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
          >
            <option value="">All States</option>
            {US_STATE_ABBRS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={filterSaleType}
            onChange={(e) => setFilterSaleType(e.target.value)}
          >
            <option value="">All Sale Types</option>
            <option value="Foreclosure">Foreclosure</option>
            <option value="Private Seller">Private Seller</option>
            <option value="Newly Foreclosed">Newly Foreclosed</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs ml-auto">
          <select
            className="bg-muted rounded px-2 py-1 border-0 outline-none text-xs"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="auction_date_desc">Newest listed ↓</option>
            <option value="bid_asc">Bid ↑</option>
            <option value="bid_desc">Bid ↓</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1 rounded hover:bg-muted"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
            <Gavel className="h-8 w-8 mx-auto opacity-30" />
            <p>No listings found. Run a sync from{' '}
              <Link to="/ceo/auction-apify-sync" className="underline underline-offset-2 text-primary">Auction.com Sync</Link>
              {' '}to populate this table.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 pl-3 text-left font-medium w-8"><Home size={13} /></th>
                  <th className="py-2 pr-3 text-left font-medium">Address</th>
                  <th className="py-2 pr-3 text-left font-medium">Sale Type</th>
                  <th className="py-2 pr-3 text-left font-medium">
                    <span className="flex items-center gap-1"><Calendar size={12} /> Auction Date</span>
                  </th>
                  <th className="py-2 pr-3 text-left font-medium">Location</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    <span className="flex items-center gap-1 justify-end"><DollarSign size={12} /> Bid</span>
                  </th>
                  <th className="py-2 pr-3 text-center font-medium">Beds/Baths</th>
                  <th className="py-2 pr-3 text-right font-medium">Sqft</th>
                  <th className="py-2 pr-3 text-left font-medium">
                    <span className="flex items-center gap-1"><MapPin size={12} /> State</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr
                    key={listing.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setDrawer(listing)}
                  >
                    <td className="py-2 pr-3 pl-3">
                      {listing.primary_photo_url ? (
                        <img
                          src={listing.primary_photo_url}
                          alt=""
                          className="h-9 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="h-9 w-12 rounded bg-muted flex items-center justify-center">
                          <Home size={14} className="text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <p className="font-medium truncate max-w-[200px]">
                        {listing.street_description || listing.address?.split(',')[0] || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {listing.municipality}{listing.postal_code ? `, ${listing.postal_code}` : ''}
                      </p>
                    </td>
                    <td className="py-2 pr-3">{saleTypeBadge(listing.sale_type)}</td>
                    <td className="py-2 pr-3 text-xs whitespace-nowrap">
                      {listing.auction_date ?? fmtDate(listing.auction_start_date)}
                      {listing.auction_location === 'Live Auction' && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(Live)</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {listing.auction_location ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs font-mono">
                      {fmtBid(listing.opening_bid ?? listing.starting_bid_amount)}
                    </td>
                    <td className="py-2 pr-3 text-center text-xs">
                      {listing.beds != null || listing.baths != null
                        ? `${listing.beds ?? '?'}bd / ${listing.baths ?? '?'}ba`
                        : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs">
                      {listing.sqft ? listing.sqft.toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono">{listing.state ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          disabled={loading}
        />
      </div>

      {/* Detail drawer */}
      {drawer && (
        <ListingDrawer listing={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}
