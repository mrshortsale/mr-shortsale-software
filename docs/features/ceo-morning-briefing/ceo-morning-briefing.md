# CEO morning briefing

## Summary

Default CEO home (`/ceo/briefing`): hero KPIs (leads pulled, calls, connections, pipeline value), top-priority lead cards, and an AI activity ticker. Serves as the daily entry point for the owner operator.

## Scope

**In scope:** `MorningBriefing.tsx` and its composed ticker/animations.

**Out of scope:** Live inventory metrics (`lead-inventory`); team-wide analytics (`team-performance`).

## Primary responsibilities

- Present day-start KPIs and urgency-ranked lead highlights.
- Reinforce “live operations” feel via ticker and counters.

## Dependencies

- **Features:** `app-shell`, `ai-agents` (ticker content may reference agent names).
- **Data:** Currently driven largely by `src/data/` mock datasets and `useLiveSimulation` toasts.

## How to navigate the code

- `src/components/ceo/MorningBriefing.tsx`
- Ticker: `src/components/ceo/AIActivityTicker.tsx`

## Open questions / gaps

- KPIs are not yet wired to production analytics tables; migrating to real aggregates is a follow-up.
