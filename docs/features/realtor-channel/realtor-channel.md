# Realtor channel

## Summary

End-to-end workflow for the listing-agent / realtor short-sale pitch channel. Ingests MLS agents from Bridge Data Output (via `bridge-mls-sync`), exposes them through the `realtor-leads` read API, and drives the CEO kanban queue, partner pipeline, outreach scripts (EN/ES), performance reports, and the rep's realtor queue.

UI components now read live data from `mls_agent_leads` via `src/services/realtor.ts`, falling back to mock data when the DB is empty (development or pre-first-sync).

## Scope

**In scope:**
- All `Realtor*` CEO components, rep `RealtorQueue`, shared `RealtorLeadDetailDrawer`.
- `realtor-leads` Edge Function (list, stats, PATCH status/notes).
- `src/services/realtor.ts` client service.
- `mls_agent_leads` as the canonical agent lead table.

**Out of scope:** MLS sync details (`bridge-mls-sync`); foreclosure inventory (`lead-inventory`).

## Primary responsibilities

- Track realtor agents from `New` through `Partnered` / `Closed Won`.
- Provide scripts and channel metrics for CEOs and reps.
- Allow status updates and notes inline from queue and pipeline views.

## Dependencies

- **Features:** `bridge-mls-sync` (populates `mls_agent_leads`), `integrations-hub`, `app-shell`, `rep-workspace`.
- **DB:** `mls_agent_leads`, `realtor_sync_runs`, `bridge_mls_sync_profiles`.
- **Edge Functions:** `realtor-leads`.

## How to navigate the code

- CEO queue: `src/components/ceo/RealtorLeadQueue.tsx`.
- CEO pipeline (kanban): `src/components/ceo/RealtorPipeline.tsx`.
- CEO reports: `src/components/ceo/RealtorReports.tsx`.
- Rep queue: `src/components/rep/RealtorQueue.tsx`.
- Shared drawer: `src/components/shared/RealtorLeadDetailDrawer.tsx`.
- Live data service: `src/services/realtor.ts` → calls `supabase/functions/realtor-leads/`.
- Mock fallback (dev): `src/data/realtorLeads.ts` (types always exported; mock array used when DB returns empty).

## Agent-primary data model

Each row in `mls_agent_leads` represents one unique agent per MLS feed (`UNIQUE(dataset_id, list_agent_key)`). `listing_count` and `latest_*` fields are refreshed on every sync; the row with the highest `latest_days_on_market` value surfaces as the lead's primary property context.
