import { ApifyClient } from 'apify-client';

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('Usage: APIFY_TOKEN=... node scripts/test-skip-trace.mjs');
  process.exit(1);
}

const client = new ApifyClient({ token });

const addresses = (process.env.ADDRESSES || '')
  .split('|')
  .map((s) => s.trim())
  .filter(Boolean);

if (addresses.length === 0) {
  console.error('Set ADDRESSES env, pipe-separated');
  process.exit(1);
}

const input = { addresses };

console.log('Skip trace input:', input);
const run = await client.actor('khadinakbar/skip-trace-property-owner').call(input, {
  waitSecs: 180,
});

console.log('Status:', run.status);
console.log('Run:', `https://console.apify.com/actors/khadinakbar~skip-trace-property-owner/runs/${run.id}`);

if (run.status === 'SUCCEEDED') {
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(JSON.stringify(items, null, 2));
} else {
  const log = await client.run(run.id).log().get();
  console.log((log || '').split('\n').slice(-30).join('\n'));
  process.exit(1);
}
