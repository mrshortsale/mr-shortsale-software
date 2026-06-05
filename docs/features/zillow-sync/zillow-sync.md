# Zillow sync (deprecated — see bridge-mls-sync)

## Summary

Original Edge Function stub that fetched Bridge Data Output listings using a hardcoded filter and returned JSON. Now superseded by `bridge-mls-sync`, which provides multi-profile fan-out, database persistence, and frontend-managed config.

The `zillow-sync` function is retained as a thin backward-compat endpoint with a `@deprecated` notice; all new callers should use `bridge-mls-sync`.

## Scope

**In scope:** `supabase/functions/zillow-sync/index.ts` (deprecated stub).

**Out of scope:** Everything — see `bridge-mls-sync` for the live implementation.

## Primary responsibilities (historical)

- Authenticate using stored `zillow` integration credentials.
- Fetch one page from Bridge OData API with a hardcoded `short sale` filter.
- Return JSON lead array to the calling client (no DB persistence).

## Dependencies

- **Features:** `bridge-mls-sync` (replacement), `integrations-hub`.

## How to navigate the code

- The active implementation is in `supabase/functions/bridge-mls-sync/` and `supabase/functions/_shared/bridge.ts`.
- Original stub: `supabase/functions/zillow-sync/index.ts`.
