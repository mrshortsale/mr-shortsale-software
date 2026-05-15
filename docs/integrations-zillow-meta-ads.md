# Zillow & Meta Lead Ads Integration

This document covers everything needed to configure, verify, and understand the data flow for the two built-in integrations on the `/ceo/integrations` page.

---

## 1. Zillow Listings (Bridge Data Output)

### Background

Zillow's own public API was shut down permanently in 2021. The only official path to Zillow listing data is **Bridge Data Output** (`bridgedataoutput.com`) — Zillow's licensed RESO Web API partner.

Non-MLS developers can use third-party wrappers (Zillapi, RapidAPI Zillow) with the same `api_key` credential field; only the Base URL changes.

### Required Credentials

| Field | Value | Where to get it |
|---|---|---|
| **API Key** | Your Bridge Data Output API key | Sign up at `bridgedataoutput.com`; requires MLS or IDX partner agreement |
| **Base URL** | `https://api.bridgedataoutput.com` | Pre-filled (already seeded) |

Auth header used on every request: `Authorization: Bearer {apiKey}`

### Configuration Steps

1. Go to `/ceo/integrations` → click **Zillow Listings**
2. Click **Edit Credentials**
3. Paste your Bridge Data Output API key into the **API Key** field
4. Base URL should already be `https://api.bridgedataoutput.com` — leave it as is
5. Click **Save**
6. Click **Test Connection** — a green "Connected successfully (Xms)" toast confirms the key is valid

### Health Check

The integration test hits: `GET https://api.bridgedataoutput.com/api/v2/zestimates`

Expects HTTP 200. The `integrations-test` Edge Function uses the generic `api_key` path (Bearer token).

### Data Rendered After Connection

After the API key is configured and connected, the `zillow-sync` Edge Function is called on demand from the frontend. It queries Bridge Data Output for short-sale listings:

```
GET /api/v2/OData/Property
  ?$filter=contains(PublicRemarks,'short sale')
  &$select=ListAgentFullName,ListOfficeName,ListAgentDirectPhone,ListAgentEmail,
           ListingId,UnparsedAddress,City,StateOrProvince,ListPrice,
           DaysOnMarket,PriceChangeTimestamp
  &$top=100
  &$orderby=DaysOnMarket desc
```

The mapped `RealtorLead` rows appear in:

- **CEO → Realtor Lead Queue** (`ceo/RealtorLeadQueue.tsx`) — Kanban by status
- **Rep → Realtor Queue** (`rep/RealtorQueue.tsx`) — filtered to assigned rep

Each card shows: listing agent name, brokerage, property address, days on market, price drop history, short-sale keyword match.

---

## 2. Meta Lead Ads (Inbound Webhook)

### Background

Meta pushes leads to your platform when a homeowner submits a Lead Ad form. This is an **inbound webhook** — Meta calls your endpoint; you do not poll Meta.

The platform's webhook receiver lives at:

```
{SUPABASE_URL}/functions/v1/webhook-receiver/meta-ads
```

### Required Credentials

| Field | Description | Where to get it |
|---|---|---|
| **App ID** | Your Meta App's numeric ID | [developers.facebook.com](https://developers.facebook.com) → Your App → App Dashboard |
| **App Secret** | Used for HMAC-SHA256 signature verification of incoming payloads | Same App Dashboard → **App Secret** (click Show, re-auth if prompted) |
| **Verify Token** | Arbitrary string you choose (e.g. `mss-meta-verify-2026`) | You define it; must match exactly when registering the webhook in Meta |
| **Page Access Token** | Token for calling the Graph API to fetch lead form field data | [Graph API Explorer](https://developers.facebook.com/tools/explorer/) → select your Page → generate with `leads_retrieval` + `pages_read_engagement` permissions |

> **App Secret** is stored as the webhook HMAC key (`webhook_secret` column). It is never returned to the frontend in plain text.

### Configuration Steps

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com) → add **Leads Access** product
2. Go to `/ceo/integrations` → click **Meta Lead Ads**
3. Click **Edit Credentials**, fill in all four fields above, click **Save**
4. Copy the **Webhook URL** shown in the panel
5. In Meta App → **Webhooks** → paste the Webhook URL + paste the same **Verify Token** → click **Verify and Save**
   - Meta sends a GET challenge to your endpoint; the Edge Function matches the verify token and echoes `hub.challenge` → Meta shows a green checkmark
6. Subscribe the webhook to your Facebook Page's **`leadgen`** topic
7. Click **Test Connection** in the panel — confirms the webhook secret is stored (status → Connected)

### Incoming Webhook Flow

```
Homeowner submits Meta Lead Form
  → Meta POST /webhook-receiver/meta-ads
    → HMAC-SHA256 verified (X-Hub-Signature-256 header vs App Secret)
    → leadgen_id extracted from payload
    → Graph API GET /v21.0/{leadgen_id}?fields=field_data,created_time,ad_id,form_id
    → name / phone / email / campaign mapped
    → Row inserted into inventory_leads (source: 'Meta')
    → Logged in integration_api_logs
```

### Data Rendered After Connection

- **CEO → Lead Inventory** (`ceo/LeadInventory.tsx`) — new row at the top with homeowner name, phone, email, campaign name, received timestamp
- **Speed-to-Lead Feed** (`shared/SpeedToLeadFeed.tsx`) — elapsed timer counting up from arrival

Lead fields stored in `inventory_leads`:

| DB Column | Value |
|---|---|
| `source` | `'Meta'` |
| `external_id` | Meta `leadgen_id` |
| `owner` | Homeowner name from form |
| `address` | Address field from form (if collected) |
| `raw_payload` | Full Graph API response |

---

## 3. Step-by-Step Verification

### Zillow

1. `/ceo/integrations` → **Zillow Listings** → Edit Credentials → paste API key → Save
2. Click **Test Connection** → green toast + status badge = `Connected`
3. Open **Realtor Lead Queue** or **Rep Realtor Queue** — real listings replace mock data
4. Open **API Usage** dashboard — one `GET /api/v2/zestimates` log entry (HTTP 200)

### Meta Lead Ads

1. Configure credentials (see Configuration Steps above)
2. Register webhook in Meta App → verify token matches → green checkmark in Meta
3. Click **Test Connection** → status = `Connected`
4. Use Meta's **Lead Ads Testing Tool** (App Dashboard → Lead Ads → Test Leads) to fire a test event
5. Check Supabase `integration_api_logs` — one `inbound` direction row for `meta-ads` (HTTP 200)
6. Check `inventory_leads` table — one new row with `source = 'Meta'`
7. Open **Lead Inventory** → test lead appears at the top
8. Open **Speed-to-Lead Feed** → elapsed timer ticking from arrival time

---

## 4. Architecture Reference

```
Zillow (outbound pull)
  Frontend zillow.ts
    → POST /zillow-sync (Edge Fn, CEO-authed)
      → Decrypt API key from integration_credentials
      → GET Bridge Data Output OData API
      → Map RESO fields → RealtorLead[]
      → Return to frontend → RealtorLeadQueue / RealtorQueue

Meta Ads (inbound push)
  Meta servers
    → GET  /webhook-receiver/meta-ads  (verification challenge)
    → POST /webhook-receiver/meta-ads  (lead event)
      → Verify X-Hub-Signature-256 HMAC with App Secret
      → Call Graph API with pageAccessToken
      → INSERT inventory_leads
      → Log in integration_api_logs
```
