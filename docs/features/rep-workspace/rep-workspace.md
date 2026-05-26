# Rep workspace

## Summary

Role-scoped experience for bilingual sales reps: urgency-sorted foreclosure queue, full-screen active call with scripts and outcomes, call history with SMS threads, and personal KPI charts.

## Scope

**In scope:** Rep routes under `/rep/*` except realtor queue (see `realtor-channel`), active call state in `AppContext`, shared lead drawer usage from queue.

**Out of scope:** CEO team analytics; inventory-wide table.

## Primary responsibilities

- Show assigned leads with filing type, urgency, equity, and language badges.
- Run call workflow (script, notes, outcome, SMS shortcut).
- History and personal performance trends.

## Dependencies

- **Features:** `user-auth`, `app-shell`, `lead-inventory` (future assignment source), `speed-to-lead` (sidebar feed).

## How to navigate the code

- Queue page: `src/pages/rep/RepQueuePage.tsx` → `LeadQueue.tsx`.
- Call flow: `src/components/rep/ActiveCall.tsx` + `AppContext`.
- Routes: `src/config/repNav.ts`.

## Open questions / gaps

- Queue still populated from `src/data/leads.ts` in demo; wire to rep-filtered `inventory-leads` API when ready.
