// Lightweight deterministic generator for ~35,000 inventory leads.
// Used for the "Lead Inventory" firehose view. Real ingestion will replace this.

export type InventorySource = 'Batch' | 'Zillow' | 'Meta' | 'Manual';
export type InventoryLang = 'EN' | 'ES';
export type InventoryStatus = 'New' | 'Triaged' | 'Promoted' | 'Dismissed';

export interface InventoryLead {
  id: string;
  source: InventorySource;
  owner: string;
  address: string;
  city: string;
  state: string;
  county: string;
  equityPct: number;
  daysToAuction: number;
  score: number; // 1-10
  language: InventoryLang;
  receivedAt: number; // ms
  status: InventoryStatus;
}

const STATES = ['FL', 'TX', 'CA', 'AZ', 'NV', 'GA', 'NC', 'IL', 'NY', 'OH'];
const COUNTIES: Record<string, string[]> = {
  FL: ['Miami-Dade', 'Broward', 'Palm Beach', 'Orange', 'Hillsborough'],
  TX: ['Harris', 'Dallas', 'Bexar', 'Travis', 'Tarrant'],
  CA: ['Los Angeles', 'San Diego', 'Orange', 'Riverside', 'Sacramento'],
  AZ: ['Maricopa', 'Pima', 'Pinal'],
  NV: ['Clark', 'Washoe'],
  GA: ['Fulton', 'DeKalb', 'Cobb', 'Gwinnett'],
  NC: ['Mecklenburg', 'Wake', 'Guilford'],
  IL: ['Cook', 'DuPage', 'Lake'],
  NY: ['Kings', 'Queens', 'Bronx', 'Nassau'],
  OH: ['Cuyahoga', 'Franklin', 'Hamilton'],
};
const FIRST_EN = ['James', 'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Mary', 'Thomas', 'Patricia'];
const FIRST_ES = ['Maria', 'Jose', 'Carlos', 'Rosa', 'Miguel', 'Ana', 'Luis', 'Carmen', 'Juan', 'Sofia'];
const LAST = ['Smith', 'Garcia', 'Johnson', 'Lopez', 'Williams', 'Martinez', 'Brown', 'Rodriguez', 'Tran', 'Diaz', 'Walsh', 'Patel', 'Nguyen', 'Ali', 'Cohen'];
const STREETS = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm Ct', 'Lake Blvd', 'Sunset Way', 'Park Pl', 'Hill St'];

// Mulberry32 PRNG — deterministic, fast
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: T[]): T { return arr[Math.floor(r() * arr.length)]; }

let _cache: InventoryLead[] | null = null;

export function getInventoryLeads(): InventoryLead[] {
  if (_cache) return _cache;
  const r = rng(42);
  const out: InventoryLead[] = [];
  const TOTAL = 34812; // Batch
  const ZILLOW = 1420;
  const META = 87;
  const now = Date.now();

  const make = (i: number, source: InventorySource): InventoryLead => {
    const state = pick(r, STATES);
    const county = pick(r, COUNTIES[state]);
    const isES = r() < 0.32;
    const first = pick(r, isES ? FIRST_ES : FIRST_EN);
    const last = pick(r, LAST);
    const equity = Math.floor(r() * 80);
    const days = Math.floor(r() * 180);
    // Score is biased: most low, few hot
    const base = r();
    const score = base < 0.85 ? Math.floor(r() * 6) + 1 : Math.floor(r() * 3) + 8;
    return {
      id: `${source.toLowerCase()}-${i}`,
      source,
      owner: `${first} ${last}`,
      address: `${Math.floor(r() * 9000) + 100} ${pick(r, STREETS)}`,
      city: county,
      state,
      county,
      equityPct: equity,
      daysToAuction: days,
      score,
      language: isES ? 'ES' : 'EN',
      receivedAt: now - Math.floor(r() * 1000 * 60 * 60 * 24 * 14),
      status: 'New',
    };
  };

  for (let i = 0; i < TOTAL; i++) out.push(make(i, 'Batch'));
  for (let i = 0; i < ZILLOW; i++) out.push(make(i, 'Zillow'));
  for (let i = 0; i < META; i++) out.push(make(i, 'Meta'));

  _cache = out;
  return out;
}

export function inventoryCounts() {
  const all = getInventoryLeads();
  return {
    total: all.length,
    Batch: all.filter(l => l.source === 'Batch').length,
    Zillow: all.filter(l => l.source === 'Zillow').length,
    Meta: all.filter(l => l.source === 'Meta').length,
    Manual: 0,
    hot: all.filter(l => l.score >= 8).length,
    triage: all.filter(l => l.score >= 7 || l.daysToAuction <= 30).length,
  };
}
