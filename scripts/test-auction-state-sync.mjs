/**
 * test-auction-state-sync.mjs
 *
 * Tests the Auction.com Apify actor across multiple US states sequentially,
 * validates data shape, and reports per-state item counts + dedup summary.
 *
 * Usage:
 *   APIFY_TOKEN=apify_api_xxx node scripts/test-auction-state-sync.mjs
 *
 * Optional env vars:
 *   STATES      — pipe-separated state names, e.g. "Florida|Texas|Ohio" (default: see below)
 *   MAX_ITEMS   — items per state (default: 20)
 *   WAIT_SECS   — actor wait timeout in seconds (default: 300)
 */

import { ApifyClient } from 'apify-client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'output');

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('Usage: APIFY_TOKEN=... node scripts/test-auction-state-sync.mjs');
  process.exit(1);
}

const REQUIRED_FIELDS = ['id', 'address', 'auction_start_date', 'saleType'];

const defaultStates = ['Florida', 'Texas', 'Ohio'];
const states = process.env.STATES
  ? process.env.STATES.split('|').map((s) => s.trim()).filter(Boolean)
  : defaultStates;

const maxItems = Number(process.env.MAX_ITEMS || 20);
const waitSecs = Number(process.env.WAIT_SECS || 300);

const client = new ApifyClient({ token });

console.log('=== Auction.com Multi-State Sync Test ===');
console.log(`States: ${states.join(', ')}`);
console.log(`Max items per state: ${maxItems}`);
console.log(`Wait timeout: ${waitSecs}s`);
console.log('');

const allItems = [];
const results = [];
let totalSuccess = 0;
let totalFailed = 0;

for (const state of states) {
  console.log(`\n── State: ${state} ──────────────────────`);

  const input = {
    buying_types: ['online', 'in_person', 'remote_bid', 'offer'],
    enrichOutput: false,
    maxItems,
    prop_types: ['single-family', 'multi-family', 'condos-townhouses', 'land'],
    sale_types: ['foreclosures', 'private-seller', 'newly-foreclosed'],
    search_term: state,
  };

  const stateStart = Date.now();

  try {
    const run = await client
      .actor('parseforge/auction-com-property-scraper')
      .call(input, { waitSecs });

    const elapsed = ((Date.now() - stateStart) / 1000).toFixed(1);
    console.log(`  Status: ${run.status}  (${elapsed}s)`);

    if (run.status !== 'SUCCEEDED') {
      const log = await client.run(run.id).log().get();
      const tail = (log || '').split('\n').slice(-20).join('\n');
      console.error(`  FAILED. Log tail:\n${tail}`);
      results.push({ state, status: 'FAILED', items: 0, error: `Actor status: ${run.status}` });
      totalFailed++;
      continue;
    }

    const { items, total } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`  Items returned: ${items.length}  (dataset total: ${total})`);

    // Validate required fields
    if (items.length > 0) {
      const firstItem = items[0];
      const presentFields = Object.keys(firstItem).sort();
      const missing = REQUIRED_FIELDS.filter((f) => !(f in firstItem));

      if (missing.length) {
        console.warn(`  WARNING: missing required fields: ${missing.join(', ')}`);
        console.warn(`  Available fields: ${presentFields.join(', ')}`);
      } else {
        console.log(`  Required fields present: ${REQUIRED_FIELDS.join(', ')}`);
      }

      // Spot-check first item
      const first = firstItem;
      console.log(`  Sample: id=${first.id}, saleType=${first.saleType}, state=${first.country_primary_subdivision}`);
      if (first.auction_start_date) {
        console.log(`          auction_start_date=${first.auction_start_date}`);
      }
    } else {
      console.log(`  No items returned for "${state}"`);
    }

    allItems.push(...items);
    results.push({ state, status: 'OK', items: items.length, runId: run.id });
    totalSuccess++;
  } catch (err) {
    const elapsed = ((Date.now() - stateStart) / 1000).toFixed(1);
    const msg = err.message || String(err);
    console.error(`  ERROR (${elapsed}s): ${msg}`);
    results.push({ state, status: 'ERROR', items: 0, error: msg });
    totalFailed++;
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────

console.log('\n\n=== Summary ===');
console.log(`States tested  : ${states.length}`);
console.log(`Succeeded      : ${totalSuccess}`);
console.log(`Failed/Errored : ${totalFailed}`);
console.log(`Total items    : ${allItems.length}`);

const uniqueIds = new Set(allItems.map((it) => String(it.id ?? '')));
console.log(`Unique IDs     : ${uniqueIds.size}`);
if (uniqueIds.size < allItems.length) {
  console.warn(`DUPLICATE IDs  : ${allItems.length - uniqueIds.size} duplicates across states`);
} else {
  console.log('Dedup check    : OK — all IDs are unique across tested states');
}

console.log('\nPer-state breakdown:');
for (const r of results) {
  const icon = r.status === 'OK' ? '✓' : '✗';
  const detail = r.status === 'OK' ? `${r.items} items` : r.error;
  console.log(`  ${icon} ${r.state.padEnd(20)} ${detail}`);
}

// ── Save output ─────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = resolve(outDir, `auction-states-${ts}.json`);
writeFileSync(
  outPath,
  JSON.stringify({ summary: results, items: allItems }, null, 2),
);
console.log(`\nSaved ${allItems.length} items → ${outPath}`);

if (totalFailed > 0) process.exit(1);
