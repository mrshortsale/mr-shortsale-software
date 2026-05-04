
# Post-meeting update plan (May 4 call with Cristina)

Based on what changed in the meeting and your answers:
- **Realtor leads** = new top-level sidebar section, separate pipeline
- **Source scoring** = skip for now (Phase 2)
- **Batch API key** = hold the key, ship UI only (no backend wiring this pass)
- **County rollout map** = not yet — single roadmap callout only

---

## 1. New "Realtor Short Sale" chain (the big one)

A second, parallel lead pipeline targeting **listing agents** of properties already on Zillow as short sales. The dialer pitches realtor-to-realtor: *"We can close this short sale for you at no cost."*

**New CEO sidebar group** "Realtor Short Sale" with 4 items:
- Realtor Pipeline (Kanban: New → Contacted → Partnered → Closed / Declined)
- Realtor Lead Queue
- Realtor Scripts (separate bilingual script library — realtor-to-realtor tone)
- Realtor Reports (deals closed via partnered realtor vs. direct homeowner)

**New Rep view**: a "Realtor Queue" tab next to the existing foreclosure queue, with a different lead card layout (listing agent name, brokerage, MLS#, days on market, list price, price-drop history, listing URL).

**New data shape** in `src/data/realtorLeads.ts`:
```ts
RealtorLead { id, agentName, brokerage, agentPhone, agentEmail, mlsNumber,
  propertyAddress, listPrice, daysOnMarket, priceDrops, listingUrl,
  state, status, lastContactAt, source: 'zillow' }
```
Seeded with ~20 realistic mock listings across FL/NY/CA.

**New integration stub** `src/integrations/zillow.ts` — mock keyword-search endpoint (`searchShortSaleListings(state, keyword)`), returns the seed data. Real Zillow API wiring deferred.

## 2. Data Sources screen updates

Add two cards alongside Batch Leads API:
- **ATOM Property API** — status: "Comparison source · pay-as-you-go · pulling sample counties (FL)". Tooltip explains it's running in parallel to validate freshness vs. Batch.
- **Zillow Listings** — status: "Realtor lead source · keyword: 'short sale' · nationwide". Links to the new Realtor section.

Update **Batch Leads API card** to honestly show "Source freshness: ~72 hr lag" (Cristina's exact concern) and a small "API key received ✓ — backend wiring pending" badge.

## 3. Roadmap update

On `RoadmapView.tsx`, add Phase 2 callout:
- "Direct county-records ingestion — pilot 5 FL counties → 20 → 50"
- "Meta Ads / PPC integration (deferred until Phase 1 ships)"

## 4. Proposal page (`/proposal`)

Two small additions:
- New bullet under "What we need from you": **API keys for Zillow + ATOM** (Cristina's email, same flow as Batch)
- New line in scope: **"Realtor Short Sale chain — separate pipeline, scripts, and reports"**

## 5. Memory updates

Update `mem://architecture/data-strategy` to add the realtor chain and ATOM-as-comparison model. Update core index to mention the two parallel chains.

---

## Technical notes

**Files new:**
- `src/data/realtorLeads.ts` — seed data + types
- `src/integrations/zillow.ts` — mock search
- `src/components/ceo/RealtorPipeline.tsx`
- `src/components/ceo/RealtorLeadQueue.tsx`
- `src/components/ceo/RealtorScripts.tsx`
- `src/components/ceo/RealtorReports.tsx`
- `src/components/rep/RealtorQueue.tsx`
- `src/components/shared/RealtorLeadDetailDrawer.tsx`

**Files edited:**
- `src/pages/CEODashboard.tsx` — new sidebar group + 4 route cases
- `src/pages/RepDashboard.tsx` — add Realtor Queue tab
- `src/components/ceo/DataSources.tsx` — add ATOM + Zillow cards, update Batch card
- `src/components/ceo/RoadmapView.tsx` — Phase 2 callout
- `src/pages/Proposal.tsx` — Zillow/ATOM key request + realtor chain scope line
- `mem://index.md`, `mem://architecture/data-strategy`

**Out of scope this pass** (per your answers):
- Real Batch/Zillow/ATOM backend calls
- Source performance scoreboard
- Counties coverage map
- Meta Ads integration

---

## What I'm NOT doing yet — confirm before I build

If any of these are wrong, tell me before approving:
1. Realtor pipeline stages are: **New → Contacted → Partnered → Closed Won / Declined** — OK?
2. Realtor leads use the **same dialer / Vapi voice agent** but with a different script library (not a separate dialer integration).
3. We keep the Batch API key Cristina sent **stored only as a note in the proposal**, not as a Lovable Cloud secret yet.

Approve and I'll implement in one pass.
