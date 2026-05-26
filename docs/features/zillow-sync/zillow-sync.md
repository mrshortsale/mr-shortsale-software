# Zillow sync

## Summary

Backend worker that pulls Zillow listing-agent / short-sale keyword leads into storage for the realtor channel UI. Client stub and docs describe expected API usage.

## Scope

**In scope:** `zillow-sync` Edge Function and `src/integrations/zillow.ts`.

**Out of scope:** Realtor kanban and scripts UI (`realtor-channel`).

## Primary responsibilities

- Authenticate using stored integration credentials.
- Upsert realtor leads for CEO/rep queues.

## Dependencies

- **Features:** `integrations-hub`, `realtor-channel`.
- **External:** Zillow (or proxy) API per integration config.

## How to navigate the code

- `supabase/functions/zillow-sync/index.ts`
- `docs/integrations-zillow-meta-ads.md`

## Open questions / gaps

- Confirm target table schema matches `realtorLeads` shape used in the UI.
