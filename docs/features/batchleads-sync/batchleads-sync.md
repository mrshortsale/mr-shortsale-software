# BatchLeads sync

## Summary

Pulls foreclosure leads from the BatchLeads API into `inventory_leads`, supporting full and incremental sync modes, pause/resume/stop, nightly cron, and CEO-facing sync history and manual controls.

## Scope

**In scope:** `batchleads-sync` and `batchleads-cron` Edge Functions, shared BatchLeads client helpers, round-robin rep assignment on ingest, Sync History page and batch sync controls.

**Out of scope:** Lead table UI and filtering (`lead-inventory`); integration credential UI (`integrations-hub`).

## Primary responsibilities

- Run paginated sync jobs with progress metadata stored on sync runs.
- Schedule nightly sync via Postgres cron (vault-backed secrets).
- Assign new leads to reps using `inventory_round_robin_state`.
- Expose sync status and history to the CEO UI.

## Dependencies

- **Features:** `lead-inventory`, `integrations-hub` (BatchLeads API keys).
- **External:** BatchLeads API; Supabase cron and vault.

## How to navigate the code

- Sync worker: `supabase/functions/batchleads-sync/index.ts`.
- Cron trigger: `supabase/functions/batchleads-cron/index.ts`.
- UI: `src/pages/ceo/SyncRunsPage.tsx`, `src/components/ceo/BatchSyncControls.tsx`.
- Docs: `docs/batchleads-incremental-sync.md`.

## Open questions / gaps

- Confirm production cron secrets and health-check migrations match the deployed Supabase project ref.
