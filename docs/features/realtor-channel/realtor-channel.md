# Realtor channel

## Summary

End-to-end UX for listing-agent / realtor leads (primarily Zillow-sourced): CEO kanban queue, partner pipeline, outreach scripts (EN/ES), performance reports, and the rep’s realtor queue with detail drawer.

## Scope

**In scope:** All `Realtor*` CEO components, rep `RealtorQueue`, shared `RealtorLeadDetailDrawer`, mock realtor lead data.

**Out of scope:** Zillow sync worker details (`zillow-sync`); foreclosure inventory (`lead-inventory`).

## Primary responsibilities

- Track realtor leads from new through partnered/closed.
- Provide scripts and channel metrics for CEOs.
- Let reps work assigned realtor leads.

## Dependencies

- **Features:** `zillow-sync`, `integrations-hub`, `app-shell`, `rep-workspace`.
- **External:** Zillow integration (when sync is enabled).

## How to navigate the code

- CEO: `src/components/ceo/Realtor*.tsx` under `/ceo/realtor-*` routes.
- Rep: `src/components/rep/RealtorQueue.tsx` (`/rep/realtor`).
- Data: `src/data/realtorLeads.ts`.

## Open questions / gaps

- UI still uses mock realtor leads; align with tables populated by `zillow-sync` when available.
