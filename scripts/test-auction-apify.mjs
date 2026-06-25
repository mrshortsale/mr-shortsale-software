import { ApifyClient } from 'apify-client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'output');

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('Usage: APIFY_TOKEN=... node scripts/test-auction-apify.mjs');
  process.exit(1);
}

const client = new ApifyClient({ token });

const input = {
  buying_types: ['online', 'in_person', 'remote_bid', 'offer'],
  enrichOutput: false,
  maxItems: Number(process.env.MAX_ITEMS || 5),
  prop_types: ['single-family', 'multi-family', 'condos-townhouses', 'land'],
  sale_types: ['foreclosures', 'private-seller', 'newly-foreclosed'],
  search_term: process.env.SEARCH_TERM || 'California',
};

const REQUIRED_FIELDS = ['id', 'address', 'auction_start_date', 'saleType'];

console.log('Input:', JSON.stringify(input, null, 2));
console.log('Starting actor run...');

try {
  const run = await client.actor('parseforge/auction-com-property-scraper').call(input, {
    waitSecs: 300,
  });

  console.log('Run status:', run.status);
  console.log('Run ID:', run.id);
  console.log('Console:', `https://console.apify.com/actors/DI837yLYBfu34xhSL/runs/${run.id}`);
  console.log('Dataset ID:', run.defaultDatasetId);

  const log = await client.run(run.id).log().get();
  const tail = (log || '').split('\n').slice(-50).join('\n');
  console.log('\n--- Log tail ---\n', tail);

  if (run.status === 'SUCCEEDED') {
    const { items, total } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('\nItems count:', items.length, '(dataset total:', total, ')');

    if (items.length > 0) {
      console.log('\nField names:', Object.keys(items[0]).sort().join(', '));
      const missing = REQUIRED_FIELDS.filter((f) => !(f in items[0]));
      if (missing.length) {
        console.warn('WARNING: missing required fields on first item:', missing.join(', '));
      } else {
        console.log('Required fields present on first item:', REQUIRED_FIELDS.join(', '));
      }
    }

    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `auction-${run.id}.json`);
    writeFileSync(outPath, JSON.stringify(items, null, 2));
    console.log('Saved:', outPath);
    console.log(JSON.stringify(items, null, 2));
  } else {
    process.exit(1);
  }
} catch (err) {
  console.error('\nRun failed:', err.message || err);
  process.exit(1);
}
