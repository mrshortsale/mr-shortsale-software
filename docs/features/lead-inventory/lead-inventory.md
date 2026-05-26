# Lead inventory

## Summary

Cross-rep foreclosure lead inventory for the CEO: searchable/filterable table, column and rep pickers, lead detail drawer, and server-backed list and status APIs. Primary store is `inventory_leads` in Supabase; the UI calls `inventory-leads` and `admin-leads` Edge Functions.

## Scope

**In scope:** Lead inventory screen (`/ceo/inventory`), client service `inventory.ts`, CEO mutations via `admin-leads`, shared lead detail and source provenance components.

**Out of scope:** BatchLeads pull/sync mechanics (`batchleads-sync`); rep queue assignment UX (`rep-workspace`).

## Primary responsibilities

- List and filter inventory leads (county, filing type, urgency, status, source).
- Open lead detail with property and contact context.
- CEO-only status updates and bulk operations via `admin-leads`.
- Types and display helpers in `inventoryLeads.ts`.

## Dependencies

- **Features:** `user-auth`, `batchleads-sync` (data ingestion), `app-shell`.
- **External:** Supabase Postgres, BatchLeads as a lead source.

## How to navigate the code

- UI: `src/components/ceo/LeadInventory.tsx`.
- Client API: `src/services/inventory.ts`.
- Read API: `supabase/functions/inventory-leads/index.ts`.
- Write/status API: `supabase/functions/admin-leads/index.ts`.

## Open questions / gaps

- Some columns or KPIs may still fall back to mock data in `src/data/` during demo mode; verify against live API in deployed environments.
