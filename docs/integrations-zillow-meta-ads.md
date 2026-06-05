# Bridge MLS & Meta Lead Ads Integration

This document covers configuration, data flow, and verification for the two main marketing integrations.

---

## 1. Bridge MLS (Zillow Listings integration)

### Background

Zillow's own public API was shut down in 2021. The platform uses **Bridge Data Output** (`bridgedataoutput.com`) — Zillow's licensed RESO Web API partner — to pull MLS listing data. One Bridge API key serves any number of approved MLS feeds (`dataset_id`s), each managed as a separate profile in the UI.

### Required Credentials

| Field | Value | Where to get it |
|---|---|---|
| **API Key** | Your Bridge Data Output API key | Sign up at `bridgedataoutput.com`; requires MLS or IDX partner agreement |
| **Base URL** | `https://api.bridgedataoutput.com` | Pre-filled (seeded) |

Auth header used on every request: `Authorization: Bearer {apiKey}`

### Configuration: API Key

1. Go to `/ceo/integrations` → click **Zillow Listings**.
2. Click **Edit Credentials**, paste your Bridge Data Output API key.
3. Click **Save** → then **Test Connection** — a green "Connected" toast confirms the key works.

### Configuration: MLS Feeds

Below the credential section, a **MLS Feeds** panel allows you to manage individual dataset feeds without any code deployment.

**To add a new feed after Bridge approval:**

1. Click **Discover from Bridge** — fetches your approved `dataset_id`s from Bridge's `/api/v2/datasets` endpoint.
2. Select the dataset from the dropdown, or click **Add manually** and type the `dataset_id` directly.
3. Optionally configure:
   - **State allowlist** — restrict to specific states (e.g., `TX, FL`).
   - **Keyword filters** — comma-separated terms to match against `PublicRemarks` (default: `short sale, shortsale`).
   - **Special listing conditions** — checkboxes for `Pre-Foreclosure`, `In Foreclosure`, `Bankruptcy Property`, `Short Sale`, `Notice Of Default`.
   - **OData Filter Override** (Advanced) — raw `$filter` string that replaces the preset builder entirely. Note: incremental watermark is NOT appended automatically when this is set.
4. Click **Test profile** — fires a `$top=1` probe and confirms the dataset/filter combination returns data.
5. Toggle **Enabled** on, click **Save**, then use the **Sync** (⚡) button to start a full sync.

### Sync Architecture

```
CEO → MlsProfilesPanel
  → integrations-manage (list/create/update/test/discover_mls_profiles)
    ↕ bridge_mls_sync_profiles

CEO → bridge-mls-sync Edge Function
  GET  → aggregate status per profile
  POST action=sync
    → For each enabled profile:
        → GET /api/v2/OData/{dataset_id}/Property
             ?$filter={built or override}
             &$select={profile.select_fields}
             &$top={page_size}
             &$orderby={sort_order}
        → Upsert bridge_property_raw
        → Upsert / merge mls_agent_leads (agent-primary)
        → Track realtor_sync_runs
        → background continue if more pages remain

bridge-mls-cron (nightly, 19:00 UTC)
  → POST bridge-mls-sync action=sync mode=incremental
    → Appends: BridgeModificationTimestamp gt {watermark}
```

**OData URL format (corrected from legacy stub):**
```
/api/v2/OData/{dataset_id}/Property
```
The old `zillow-sync` stub incorrectly omitted `{dataset_id}`; all new syncs use the correct path.

### Data model

`mls_agent_leads` is agent-primary: one row per `(dataset_id, list_agent_key)`. Multiple distressed listings by the same agent increment `listing_count` and refresh `latest_*` fields. This drives the realtor pitch queue — you're pitching the agent, not the property.

### Data rendered after sync

- **CEO → Realtor Lead Queue** — live agent rows tagged by dataset/MLS feed.
- **CEO → Realtor Pipeline** — kanban by workflow status.
- **CEO / Rep → Reports / Queue** — DB-backed aggregates.
- **CEO → Data Sources** — shows connected status, feeds enabled count, last sync time.
- **CEO → Sync Runs** — per-run history with pause/resume controls.

### Nightly incremental sync

Migration `019_bridge_mls_cron.sql` schedules `bridge-mls-cron` at 19:00 UTC daily via pg_cron + pg_net. This fires `bridge-mls-sync` in incremental mode (`BridgeModificationTimestamp gt {watermark}`). Requires the `supabase_anon_key` Vault secret (same as Batch Leads cron).

---

## 2. Meta Lead Ads (Inbound Webhook)

### Background

Meta pushes leads when a homeowner submits a Lead Ad form. The platform's webhook receiver is:

```
{SUPABASE_URL}/functions/v1/webhook-receiver/meta-ads
```

### Required Credentials

| Field | Description | Where to get it |
|---|---|---|
| **App ID** | Meta App numeric ID | [developers.facebook.com](https://developers.facebook.com) → App Dashboard |
| **App Secret** | HMAC-SHA256 signature verification | Same App Dashboard → App Secret |
| **Verify Token** | Arbitrary string you define | You define it; must match when registering the webhook in Meta |
| **Page Access Token** | Graph API token for fetching lead form data | [Graph API Explorer](https://developers.facebook.com/tools/explorer/) → `leads_retrieval` + `pages_read_engagement` permissions |

> **App Secret** is stored as the webhook HMAC key (`webhook_secret` column) and never returned to the frontend in plain text.

### Configuration Steps

1. Create a Meta App → add **Leads Access** product.
2. Go to `/ceo/integrations` → **Meta Lead Ads** → Edit Credentials → fill all four fields → Save.
3. Copy the **Webhook URL** from the panel.
4. In Meta App → **Webhooks** → paste URL + Verify Token → click **Verify and Save**.
5. Subscribe the webhook to your Page's `leadgen` topic.
6. Click **Test Connection** → status = `Connected`.

### Incoming Webhook Flow

```
Homeowner submits Meta Lead Form
  → Meta POST /webhook-receiver/meta-ads
    → HMAC-SHA256 verified (X-Hub-Signature-256 vs App Secret)
    → leadgen_id extracted
    → Graph API GET /v21.0/{leadgen_id}?fields=field_data,...
    → Row inserted into inventory_leads (source: 'Meta')
    → Logged in integration_api_logs
```

### Data rendered

- **CEO → Lead Inventory** — new row with homeowner name, phone, email, campaign.
- **Speed-to-Lead Feed** — elapsed timer from arrival time.

---

## 3. Verification Checklist

### Bridge MLS

1. Integrations → Zillow Listings → edit credentials → paste API key → Save.
2. Test Connection → green toast → status `Connected`.
3. MLS Feeds panel → Add feed (e.g. `actris_ref`) → Test profile → Enabled → Save → Sync.
4. Realtor Lead Queue shows live agent rows after sync completes.
5. Sync Runs page shows the run with agent count and per-profile status.

### Meta Lead Ads

1. Configure credentials → register webhook in Meta → verify token → green checkmark.
2. Test Connection → `Connected`.
3. Use Meta's **Lead Ads Testing Tool** to fire a test event.
4. Check `integration_api_logs` — one inbound row (HTTP 200).
5. Check `inventory_leads` — new `source = 'Meta'` row.
6. Lead Inventory → test lead at the top; Speed-to-Lead Feed → timer ticking.
