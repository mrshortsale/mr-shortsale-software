/**
 * Test script: Zillow Search → Agent scraper pipeline
 *
 * Fetches ALL listings from the search actor dataset (no cap),
 * batches detailUrls into groups of 5 (actor hard limit),
 * runs the agent scraper for each batch, and writes results to
 * scripts/output/agents-<timestamp>.json.
 *
 * Usage:
 *   APIFY_TOKEN=your_token node scripts/test-zillow-apify.js
 */

import { ApifyClient } from 'apify-client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Config ────────────────────────────────────────────────────────────────────

const APIFY_TOKEN     = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  console.error('Usage: APIFY_TOKEN=... node scripts/test-zillow-apify.js');
  process.exit(1);
}

const SEARCH_ACTOR_ID = 'X46xKaa20oUA1fRiP';
const AGENT_ACTOR_ID  = '1NT8sDVAgchUDnHOc';
const AGENT_BATCH_SIZE = 5;    // hard limit enforced by the agent actor

// FL short-sale search URL (with mapBounds so PAGINATION_WITH_ZOOM_IN works)
const SEARCH_URL =
  'https://www.zillow.com/washington-dc/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A39.036217704904956%2C%22south%22%3A38.75083496553353%2C%22east%22%3A-76.74472431542968%2C%22west%22%3A-77.2844276845703%7D%2C%22mapZoom%22%3A12%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22att%22%3A%7B%22value%22%3A%22short%20sale%22%7D%2C%22sch%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%2C%22curatedCollection%22%3Anull%2C%22usersSearchTerm%22%3A%22Washington%2C%20DC%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A41568%2C%22regionType%22%3A6%7D%5D%7D';

// ─────────────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, 'output');

const client = new ApifyClient({ token: APIFY_TOKEN });

(async () => {
  // ── Phase 1: Search scraper ─────────────────────────────────────────────────
  console.log('▶  Phase 1 — Starting Zillow Search Scraper...');

  const searchRun = await client.actor(SEARCH_ACTOR_ID).call({
    searchUrls: [{ url: SEARCH_URL }],
    extractionMethod: 'PAGINATION_WITH_ZOOM_IN',
  });

  console.log(`✔  Search actor finished  (status: ${searchRun.status})`);
  console.log(`   Dataset ID : ${searchRun.defaultDatasetId}`);

  // Fetch ALL items — no limit
  const { items: listings } = await client
    .dataset(searchRun.defaultDatasetId)
    .listItems();

  console.log(`✔  Fetched ${listings.length} listings from dataset`);

  // Extract detailUrl from each listing
  const propertyUrls = listings
    .map(item => item.detailUrl)
    .filter(url => typeof url === 'string' && url.startsWith('http'));

  console.log(`✔  Extracted ${propertyUrls.length} valid detailUrls`);

  if (propertyUrls.length > 0) {
    console.log('   Sample:', propertyUrls.slice(0, 3));
  }

  if (propertyUrls.length === 0) {
    console.error('✗  No detailUrls found — check that the search actor returned results.');
    process.exit(1);
  }

  // ── Phase 2: Agent scraper (max 5 URLs per run — batch them) ─────────────────
  const totalBatches = Math.ceil(propertyUrls.length / AGENT_BATCH_SIZE);
  console.log(`\n▶  Phase 2 — Zillow Owner/Agent Scraper`);
  console.log(`   ${propertyUrls.length} URLs → ${totalBatches} batches of ${AGENT_BATCH_SIZE}`);

  const allAgents = [];
  let stoppedEarly = false;

  for (let i = 0; i < propertyUrls.length; i += AGENT_BATCH_SIZE) {
    const batch = propertyUrls.slice(i, i + AGENT_BATCH_SIZE);
    const batchNum = Math.floor(i / AGENT_BATCH_SIZE) + 1;

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} URLs)... `);

    try {
      const agentRun = await client.actor(AGENT_ACTOR_ID).call({ propertyUrls: batch });
      const { items: agents } = await client
        .dataset(agentRun.defaultDatasetId)
        .listItems();
      // Keep only records with usable contact info (actor returns null+404 when blocked)
      const usable = agents.filter(a => a.agentName || a.agentPhoneNumber || a.brokerName);
      process.stdout.write(`${agents.length} returned, ${usable.length} with contact\n`);
      allAgents.push(...usable);
    } catch (err) {
      process.stdout.write(`FAILED\n`);
      console.error(`   ✗  ${err.message}`);
      // Stop on account/usage errors — retrying won't help
      if (/limit|disabled|403|401/i.test(err.message)) {
        stoppedEarly = true;
        break;
      }
    }
  }

  // ── Write whatever was collected ──────────────────────────────────────────────
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = resolve(outputDir, `agents-${timestamp}.json`);

  writeFileSync(outFile, JSON.stringify(allAgents, null, 2), 'utf8');

  if (stoppedEarly) {
    console.log(`\n⚠  Stopped early (Apify usage limit / auth). Partial results saved.`);
  }
  console.log(`\n✔  Agents with contact info : ${allAgents.length}`);
  console.log(`✔  Results written to       : ${outFile}`);
})();
