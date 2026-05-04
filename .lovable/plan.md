## Part A — SOW vs `/proposal` page: gap analysis

The signed-Friday SOW is **Phase 1 only, no realtor chain**. Today's meeting added the Realtor Short Sale chain. Here's where the live `/proposal` page already aligns and where it drifts.

### ✅ Already matching

| SOW item | Proposal page |
|---|---|
| $4,500 Phase 1 build fee, 50/50 split | ✅ matches |
| $99/mo managed hosting | ✅ matches |
| 6-week timeline (Discovery → Foundation → AI Scoring → Mojo+Meta → Testing → Launch) | ✅ matches |
| Batch Leads API · 35K leads · 3,100 counties · $3.95/mo | ✅ matches |
| Mojo Triple Dialer billed under client's existing sub | ✅ matches |
| Meta/Facebook Speed-to-Lead, 5-min timer | ✅ matches |
| Bilingual EN/ES interface | ✅ matches |
| AI Lead Scoring (equity, motivation, property signals) | ✅ matches |
| Ownership: code, data, no licensing fees | ✅ matches |

### ⚠️ Gaps to close

1. **Realtor Short Sale chain is NOT in the SOW.** It's only on the proposal page. The signed SOW must be amended (or a SOW addendum issued) to add a new section "2.x Realtor Short Sale Chain" describing: Zillow listing-agent lead ingestion, dedicated pipeline + queue + scripts + reports, realtor-to-realtor outreach model, bilingual scripts. Today's meeting promoted this into Phase 1 — the SOW needs to follow.

2. **Phase 2 list mismatch.** SOW lists 4 Phase 2 items (AI Voice, ATTOM, County scraper, ICP Learning Loop). Proposal page lists 5 (adds "Source performance scoring"). Either add it to the SOW or drop it from the proposal page. Recommend keeping it on proposal + amending SOW.

3. **Client Responsibilities count drifted.** SOW = 8 items (4 before Week 1, 4 in onboarding). Proposal page = 10 items (added ⑤ Batch key receipt, ⑥ Zillow + ATOM keys). The two new keys are correct given today's meeting — SOW must be updated to match.

4. **Zillow + ATOM data sources** mentioned on proposal page but not in SOW. Add ATOM to Section 2.x as a "comparison source" and Zillow as the realtor-chain source. Note ATOM is pay-as-you-go.

5. **AI + SMS APIs (OpenAI, Gemini, Twilio)** appear in proposal cost table with Option A / Option B model, but the SOW's Section 5 cost table is leaner. Confirm Section 5 lists these line items and the A/B model. (Could not verify from the PDF parse pages I have — flagging for George to double-check.)

6. **`@mrshortsale.net` email domain** mentioned on proposal page (item ⑥ sub-text). Not in SOW. Minor — add to onboarding section.

7. **Phase 1 build fee may need re-pricing.** Adding a parallel realtor chain (Zillow integration, separate pipeline screens, separate scripts, separate reports) is real scope. Recommend either: (a) SJ absorbs it as a goodwill addition since the meeting committed verbally, or (b) issue a small change-order ($500–$1,500). Flagging for George/Shahed; no UI change either way.

### 🟡 Watch-outs (not gaps, but worth noting)

- SOW says "**up to** 35,000 leads/month" — proposal page reads "35,000 leads/month" without the qualifier. Minor copy tightening.
- SOW Section 2.7 says "Cloud-hosted on a reliable platform" without naming the host. Proposal page doesn't say either. Good — keep it that way (deliberately vendor-agnostic per earlier direction to never say "Supabase").
- SOW Section 2.9 AI/ML disclaimer is not surfaced anywhere on the proposal page. Acceptable — disclaimer lives in the contract, not the marketing page.

---

## Part B — Build: Realtor Lead Queue (the user-requested work)

The user said: *"only exception is the realtor lead queue ... go ahead and work on it."*

There are currently **two** realtor queue surfaces, both thin first-pass implementations:

- `src/components/rep/RealtorQueue.tsx` — Sales Rep view, basic card list with name/brokerage/address/price/DOM. No filtering, no sorting, no priority signals.
- `src/components/ceo/RealtorLeadQueue.tsx` — CEO view (haven't deeply audited yet, but likely similar).

### Polish & feature additions (both surfaces)

1. **Top filter bar**
   - State chip filter (FL, TX, CA, etc. — pulled from data)
   - Status filter (New / Contacted / Partnered / Declined)
   - "Bilingual ES" toggle
   - Sort dropdown: Newest listing · Most price drops · Longest DOM · Highest list price

2. **Lead card upgrades**
   - Status pill colored by stage (New = teal, Contacted = amber, Partnered = green, Declined = muted)
   - "Hot" badge when ≥2 price drops OR DOM ≥ 90 days (motivated listing)
   - MLS# shown
   - Last-contact-at relative time ("Last touched 3d ago")
   - Inline "Open Zillow listing" button → `lead.listingUrl`
   - Inline "Call agent" + "Email agent" quick actions
   - Language flag (🇺🇸 / 🇪🇸)

3. **Queue header strip**
   - Total realtor leads · New today · Awaiting follow-up · Partnered this week
   - "Source: Zillow · synced 12 min ago" freshness indicator (matches the Batch ~72hr lag pattern we use elsewhere)

4. **Empty + loading states**
   - Friendly empty state if filters return zero
   - Skeleton rows on initial load

5. **CEO-only additions on `RealtorLeadQueue.tsx`**
   - Assign-to-rep dropdown per row
   - Bulk select + bulk assign

6. **Drawer integration**
   - Continue using `RealtorLeadDetailDrawer` on row click — add a "Suggested opener (EN/ES)" panel that pulls from the realtor scripts library based on agent's language.

### Data needs

- Confirm `realtorLeads.ts` carries: `mlsNumber`, `listingUrl`, `language`, `lastContactAt`, `priceDrops[]`, `daysOnMarket`, `status`. If any field is missing, extend the seed data — no backend change.

### Out of scope this pass

- Real Zillow API wiring (still held)
- Realtor Pipeline kanban polish (separate ticket)
- Realtor scripts library polish (separate ticket)

---

## Recommendation / next steps for the team

1. **Approve this plan** → I implement the realtor-queue polish (rep + CEO surfaces) with filtering, sorting, hot-lead signals, status colors, freshness banner, drawer enhancement. ~6 file edits, no new dependencies.
2. **Separately**, George/Shahed should issue a **SOW Addendum #1** covering: realtor chain Section 2.x, Zillow + ATOM under data sources, updated 10-item client-responsibility list, Phase 2 source-scoring line. I can draft the addendum as a `.docx` artifact in `/mnt/documents/` if you want — just say the word.

## Quick confirm before I build

1. Build the realtor-queue polish on **both** rep and CEO surfaces, or rep only this pass?
2. Want me to also draft the **SOW Addendum #1 .docx** so George can send it tomorrow alongside the contract?
3. Any specific filter/sort she asked for in the meeting that I should prioritize? (I picked the obvious ones; let me know if she called out something specific.)
