# Data sources health

## Summary

CEO admin view (`/ceo/data`) showing connection status, last sync time, records pulled, and error rates for primary lead data providers (Realie.ai, Batch Leads, ATTOM).

## Scope

**In scope:** `DataSources.tsx` presentation.

**Out of scope:** Credential management (`integrations-hub`); actual sync jobs (`batchleads-sync`, `zillow-sync`).

## Primary responsibilities

- Summarize per-source health at a glance.
- Link operational mental model to integration configuration elsewhere.

## Dependencies

- **Features:** `integrations-hub`, `batchleads-sync`.
- **Data:** May use static or derived status until all providers expose live health endpoints.

## How to navigate the code

- `src/components/ceo/DataSources.tsx`

## Open questions / gaps

- Realie and ATTOM cards may be placeholder until corresponding sync functions exist.
