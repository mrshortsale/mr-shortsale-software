# Speed-to-lead

## Summary

Highlights leads that just landed in the system and how long they have waited for first contact. Full-screen CEO view plus a compact sidebar feed reused in the rep lead queue.

## Scope

**In scope:** `SpeedToLeadScreen`, `SpeedToLeadFeed`.

**Out of scope:** Lead ingestion (`batchleads-sync`); dialer session UI (`mojo-dialer-view`).

## Primary responsibilities

- Surface newest leads with elapsed timers and urgency emphasis.
- Embed compact feed beside rep queue.

## Dependencies

- **Features:** `lead-inventory`, `rep-workspace`, `app-shell`.
- **Simulation:** `useLiveSimulation` may fire periodic demo toasts.

## How to navigate the code

- CEO: `src/components/ceo/SpeedToLeadScreen.tsx` (`/ceo/speed`).
- Shared feed: `src/components/shared/SpeedToLeadFeed.tsx`.

## Open questions / gaps

- Feed should subscribe to inventory ingest events or polling rather than static samples for production.
