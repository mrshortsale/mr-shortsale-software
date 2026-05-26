# Short sale pipeline board

## Summary

Kanban board of active short-sale cases across stages (e.g. initial contact through bank approval). Cards show homeowner, address, equity, auction date, and assigned rep; opening a card shows the case timeline in `CaseDetailDrawer`.

## Scope

**In scope:** Pipeline board UI and case detail drawer.

**Out of scope:** Foreclosure lead inventory (`lead-inventory`); rep personal pipeline counts (`rep-workspace`).

## Primary responsibilities

- Visualize case stage progression.
- Surface case notes, bank/attorney info, and timeline in the drawer.

## Dependencies

- **Features:** `app-shell`, `user-auth`.
- **Data:** `src/data/pipeline.ts`, `src/data/caseDetails.ts` (mock in current demo).

## How to navigate the code

- `src/components/ceo/PipelineBoard.tsx`
- `src/components/ceo/CaseDetailDrawer.tsx`

## Open questions / gaps

- No Postgres-backed `cases` table yet; production will need schema and APIs.
