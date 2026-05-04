## The real problem

Today the **Pipeline** view treats every imported lead as a "card." That works for 12 active short-sale cases, but it will collapse under **35,000 Batch leads/month**, where ~99% will never become a case. The CEO needs two completely separate mental models:

1. **Inventory** = the firehose. 35k+ rows, mostly cold, must be filterable, scoreable, and triageable in bulk. Looks like a spreadsheet/list.
2. **Pipeline** = the funnel. ~12–50 active cases that humans actually work. Looks like the current Kanban board.

Right now those two are blurred. We should split them and add **per-page source provenance chips** (so the CEO always sees "where did these rows come from + when did it last sync") at the top of every data screen.

## Proposed structure

### A. New "Lead Inventory" page (replaces nothing — adds a new CEO tab)

A high-density list/table view designed for **35k rows**:

```text
┌─ Lead Inventory ────────────────────────────────────────────────┐
│ Source: ●Batch (34,812)  ●Zillow (1,420)  ●Meta (87)  ●Manual   │
│ Last sync: Batch 2h ago · Zillow 12m ago · Meta live            │
├─────────────────────────────────────────────────────────────────┤
│ [Search owner/address/county] [State▾] [County▾] [Score≥7] [⚡] │
│ Saved views: ★ Hot FL · ★ ES + high equity · ★ New today        │
├─────────────────────────────────────────────────────────────────┤
│ ☐  Owner            Addr           Eq%  Auction  Score  Lang  ⋯│
│ ☐  Patricia Lopez   123 Main, FL    42  18d      ●9    ES   👁│
│ ☐  James Tran       77 Oak, TX      28  41d      ●7    EN   👁│
│ ... (virtualized — 50 rows visible, 35k scrollable)             │
├─────────────────────────────────────────────────────────────────┤
│ Selected: 23   [Push to Mojo] [Assign to rep] [Promote to       │
│                                              Pipeline] [Discard]│
└─────────────────────────────────────────────────────────────────┘
```

Key behaviors:
- **Virtualized table** (`@tanstack/react-virtual` or simple windowing — already in stack via shadcn). Renders only visible rows; handles 35k cleanly.
- **Default view = "Triage queue"**: AI score ≥ 7 OR auction ≤ 30d. Everything else hidden behind "Show all 34,812".
- **Bulk actions**: select N rows → Push to Mojo / Assign / Promote / Discard. This is the only sane UX at this volume.
- **Saved filters / segments**: CEO and reps build their own ("FL + ES + score 8+"). Stored in localStorage for prototype, DB later.
- **"Promote to Pipeline"** is the explicit handoff — only promoted leads become Kanban cards. Cleanly enforces the inventory-vs-pipeline split.

### B. Pipeline (existing) becomes "Active Cases"

- Rename CEO tab from `Pipeline` → **`Active Pipeline`** with subtitle *"Cases being worked — promoted from Lead Inventory"*.
- Keep the 4-column Kanban exactly as-is. Add a top stat strip: *"12 active · 0 denials · avg close 67d · 3 promoted today from Inventory"*.
- Each card already represents a real case — no change.

### C. Source-provenance chip strip (reusable component)

Add a `<SourceProvenance />` strip to the top of every data-bearing CEO screen (Inventory, Pipeline, Speed-to-Lead, Realtor Queue, Realtor Pipeline). One row of pills:

```text
●Batch Leads · synced 2h ago · 34,812 rows   [Open Data Sources →]
●Zillow      · synced 12m ago · 1,420 listings
●Meta Ads    · live webhook · 87 today
```

Clicking any chip jumps to the Data Sources screen with that source pre-selected. This is what the CEO asked for: *"on top of those pages where the data is coming from"*.

### D. "Show me the firehose" indicator on Sales Rep view

Reps don't need 35k rows — they only see leads **assigned to them** (already true). Add a small banner:
*"You're seeing 47 of 34,812 Batch leads · auto-assigned by AI score + territory"* — so reps trust the funnel.

## Files to touch

**New files**
- `src/components/ceo/LeadInventory.tsx` — virtualized table, filters, bulk actions
- `src/components/shared/SourceProvenance.tsx` — reusable chip strip
- `src/data/inventoryLeads.ts` — generator that fakes 35,000 rows (deterministic, lightweight) and a `promoteToPipeline()` helper
- `src/hooks/useSavedViews.ts` — localStorage-backed saved filters

**Edited files**
- `src/pages/CEODashboard.tsx` — add `inventory` nav item between `dashboard` and `pipeline`; rename `Pipeline` label → `Active Pipeline`
- `src/components/ceo/PipelineBoard.tsx` — add stat strip ("3 promoted from Inventory today") + `<SourceProvenance />` at top
- `src/components/ceo/SpeedToLeadScreen.tsx` — add `<SourceProvenance />` strip (Meta only)
- `src/components/ceo/RealtorLeadQueue.tsx` — replace ad-hoc Zillow line with `<SourceProvenance />` (Zillow)
- `src/components/ceo/RealtorPipeline.tsx` — same chip strip
- `src/components/rep/LeadQueue.tsx` — small "47 of 34,812" funnel banner
- `src/components/ceo/MorningBriefing.tsx` — link "New leads overnight: 412" → opens Inventory pre-filtered

**Dependencies**
- `@tanstack/react-virtual` for the 35k-row virtualized table (~5KB, no peer issues)

## Out of scope for this pass

- Real Batch API ingestion (still pending key wire-up). Inventory uses generated mock rows tagged with the right source.
- Server-side pagination / DB indexing — when Lovable Cloud is enabled and Batch is wired, swap the in-memory generator for a paginated query against a `leads_inventory` table with a Postgres index on `(source, score, state)`.
- Saved views syncing across devices — localStorage only for prototype; move to DB later.

## What this gives the CEO in the demo

1. A page that **honestly looks like 35,000 rows**, not 12 cards — credibility with George.
2. A clear **"promote to pipeline"** action — answers the "what happens to all the rest?" question.
3. **Provenance chips on every page** — at a glance she sees data freshness without opening Data Sources.
4. Sets up the Phase-2 county scoring story: chips will later show *"Batch (3-day lag) · ATOM (live) · pick freshest"*.

## Open questions

1. Want **bulk "Discard / Mark not interested"** to actually remove rows from inventory in the prototype, or just hide them in a "Dismissed" view? (Recommend hide — never delete.)
2. Should reps also get an Inventory tab (read-only, filtered to their territory) or stay queue-only? (Recommend queue-only — reps shouldn't drown in 35k.)
