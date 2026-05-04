## Goal

Cristina wants the **Realtor Short Sale chain promoted into Phase 1** (live in the demo, visible in the sidebar). Also re-check the meeting transcript for anything else that should be Phase 1 instead of Phase 2.

## Changes

### 1. Promote Realtor Short Sale to Phase 1 (live)

**`src/pages/CEODashboard.tsx`** — restore the Realtor Short Sale sidebar group between Data Sources and the "Other" divider:

- Realtor Pipeline
- Realtor Lead Queue
- Realtor Scripts
- Realtor Reports

Remove `realtor-*` entries from `previewLabels` (no longer preview-only).

**`src/pages/RepDashboard.tsx`** — restore the "Realtor Queue" tab next to "Foreclosure Queue" so reps can work both chains.

**`src/components/ceo/RoadmapView.tsx`** — move all realtor deliverables out of Phase 2 and into Phase 1:

Phase 1 deliverables become:
- Realie.ai + Batch Leads API integration
- Equity filter pipeline (≤25%)
- Mojo Dialer API connection
- CEO dashboard v1
- Sales rep lead queue (foreclosure)
- **Realtor Short Sale chain — Zillow listing-agent leads, dedicated pipeline, queue, scripts, reports**
- **Bilingual (EN/ES) realtor-to-realtor script library**
- SMS auto-follow-up (Twilio)
- Parallel run with current vendor

Phase 1 status stays "Live in Demo." Phase 2 keeps only AI Agents, AI Inbound Calls, ATTOM cross-check, urgency scoring, duplicate detection, Meta Ads.

### 2. Other items from the meeting that belong in Phase 1

Re-reading the transcript, these were called out as "we need this from day one," so move them into Phase 1 visibility:

- **Source freshness banner** on Data Sources (Batch ~72hr lag warning) — already built, just confirm it shows on the live Data Sources screen.
- **ATOM as a parallel comparison source card** on Data Sources — already built, keep visible (Cristina wants A/B from the start, even if pay-as-you-go).
- **Zillow source card** on Data Sources — keep visible, since realtor chain is now Phase 1.
- **Onboarding checklist on `/proposal`** already lists realtor-chain items; verify it reads as Phase-1 scope (no "Phase 2" labels next to realtor lines).
- **`@mrshortsale.net` email domain** for team accounts — confirm any seeded user emails in `src/data/users.ts` use this domain.

### 3. Update memory

Update `mem://index.md` Core to drop "(Phase 2)" framing — realtor chain is now part of the live Phase 1 product.

## Stays in Phase 2 (preview only via Roadmap)

- AI Agents Roster
- AI Inbound Calls (Vapi voice handling)
- ATTOM equity cross-check automation
- Urgency scoring 1–10
- Duplicate detection
- Meta Ads / PPC

## Stays in Phase 3

- 24/7 Vapi inbound voice
- Outbound AI dialer
- Direct county-records ingestion
- Per-county source scoring

## Out of scope

- No new components — all realtor screens already exist.
- No backend wiring (Batch/Zillow/ATOM keys still held).

## Quick confirm

1. Move **all four** realtor screens (Pipeline, Queue, Scripts, Reports) into Phase 1 sidebar — yes?
2. Keep **AI Agents + AI Inbound Calls** in Phase 2 preview (not Phase 1) — yes? Cristina mentioned Vapi but framed it as future-state, so I'm keeping it preview unless you say otherwise.
3. Anything else from the meeting you remember her saying "I need this now"? E.g. SMS templates, specific report, user invites — let me know and I'll fold it in.
