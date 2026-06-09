# Zillow Apify Sync

## Summary

Scrapes Zillow listing and listing-agent data via Apify actors, deduplicates by agent phone number (agent-primary model), and feeds the resulting leads into the shared sales workflow (rep assignment, round-robin, Mojo Dialer push, status tracking). Operates independently from the Bridge MLS channel with its own sync profiles, run history, and queue page.

## Scope

**In scope**

- Apify integration credential storage (API token, search actor ID, agent actor ID)
- `zillow_apify_sync_profiles` — per-search-URL configuration stored in Postgres
- `zillow_listing_staging` — raw per-property rows from the search actor, retained for auditing and phase-2 input
- `zillow_agent_leads` — agent-primary dedup table; one row per unique listing agent
- Two-phase sync: Phase A (search → staging) + Phase B (agent enrichment) orchestrated by the `zillow-apify-sync` edge function
- Round-robin lead assignment scoped to `zillow_apify` using the shared `inventory_round_robin_state` table
- CEO-facing pages: `/ceo/zillow-apify-sync` (profiles + controls + history) and `/ceo/zillow-realtor-queue` (lead queue)
- Mojo Dialer push for Zillow agent leads

**Out of scope (v1)**

- Cron scheduling (manual sync only)
- Unified realtor pipeline combining Bridge MLS + Zillow leads
- Re-enrichment of stale agents (missing email, changed phone)

## Primary responsibilities

- `supabase/migrations/026_zillow_apify.sql` — schema: tables, indexes, RLS, round-robin seed row, Apify integration row
- `supabase/functions/_shared/apify.ts` — Apify API client: load credentials, start run, poll, fetch dataset, build external IDs
- `supabase/functions/zillow-apify-sync/` — sync orchestrator: Phase A (search) → Phase B (agent enrichment) → Phase C (round-robin)
- `supabase/functions/zillow-apify-manage/` — profile CRUD + URL builder
- `supabase/functions/zillow-realtor-leads/` — GET/PATCH/POST API for `zillow_agent_leads`
- `supabase/functions/integrations-test/` — extended with Apify `GET /v2/users/me` health check
- `src/services/zillowApify.ts` — frontend service layer
- `src/pages/ceo/ZillowApifySyncPage.tsx` — profile management UI with URL builder and sync controls
- `src/pages/ceo/ZillowRealtorQueuePage.tsx` — lead queue with filter, bulk assign, Mojo push
- `src/components/integrations/IntegrationConfigPanel.tsx` — extended with Apify-specific credential fields (API token, search actor ID, agent actor ID)

## Dependencies

- **Apify** — external scraping platform; actors `X46xKaa20oUA1fRiP` (search) and `1NT8sDVAgchUDnHOc` (agent)
- **`_shared/roundRobin.ts`** — `assignUnassignedZillowLeadsRoundRobin`, `ZILLOW_APIFY_SCOPE`
- **`_shared/crypto.ts`** — AES-GCM encryption for stored Apify credentials
- **`supabase/functions/mojo-push/`** — Mojo Dialer push (maps Zillow lead shape to Zapier payload)
- **`src/services/realtor.ts`** — `fetchRealtorReps` is reused to populate rep dropdowns
- Env vars: `SUPABASE_URL`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `INTEGRATION_ENCRYPTION_KEY`

## How to navigate the code

1. Start with `supabase/migrations/026_zillow_apify.sql` to understand the data model.
2. `supabase/functions/_shared/apify.ts` defines all Apify API calls and the `buildExternalId` dedup logic.
3. The main sync flow is in `supabase/functions/zillow-apify-sync/index.ts` — `phaseA` (search → staging) → `phaseB` (agent enrichment → upsert) → round-robin.
4. Profile management lives in `supabase/functions/zillow-apify-manage/index.ts` including the server-side URL builder.
5. Frontend entry points: `ZillowApifySyncPage.tsx` (sync management) and `ZillowRealtorQueuePage.tsx` (lead queue).
6. Apify credentials are configured in Admin › Integrations › Apify, handled by `IntegrationConfigPanel.tsx` (special branch for `slug === 'apify'`).

## Open questions / gaps

- The Apify actor input schemas (`searchUrls` for search actor; `startUrls` for agent actor) are assumed based on common Apify conventions. Verify actual field names in the Apify console before first production run.
- `max_listings` per profile caps spend; the CEO should confirm a comfortable value before enabling a profile.
- Phase B agent enrichment runs inline in a single edge function invocation. For very large staging batches (>200 listings), chunked `_internalContinue` calls may be needed to avoid the 30-second edge timeout.
