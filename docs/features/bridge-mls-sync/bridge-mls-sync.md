# Bridge MLS Sync

## Summary

Config-driven worker that ingests MLS listing data from Bridge Data Output (RESO Web API) and upserts agent-primary leads into the database for the realtor pitch workflow. A CEO can add any Bridge-approved `dataset_id` from the UI — no code deploy required.

## Scope

**In scope:**
- `bridge-mls-sync` Edge Function (sync worker with background chunking, pause/resume/stop).
- `bridge-mls-cron` Edge Function (nightly incremental trigger via pg_cron).
- `_shared/bridge.ts` (credentials, filter builder, OData fetching, agent mapper).
- `integrations-manage` extensions for MLS profile CRUD.
- `MlsProfilesPanel` UI — discover/add/edit/test/enable MLS feeds.
- `MlsSyncControls` UI — inline sync controls for the CEO.
- Database tables: `bridge_mls_sync_profiles`, `bridge_property_raw`, `mls_agent_leads`, `realtor_sync_runs`.

**Out of scope:**
- Zillow.com ZPID/listing URL construction (Bridge gives MLS IDs, not Zillow URLs).
- Cross-MLS agent dedup (same agent in TX + NY stays two rows — `UNIQUE(dataset_id, list_agent_key)`).
- Virtual Dataset support on Bridge.
- Round-robin rep assignment.

## Primary responsibilities

- Load all `enabled = true` profiles from `bridge_mls_sync_profiles`.
- Fan out: one sync run per profile, paralleled in the background.
- For each OData page: upsert raw payload to `bridge_property_raw`; upsert/merge agent row in `mls_agent_leads` (increment `listing_count`, refresh `latest_*` when DOM is higher).
- Track sync run lifecycle in `realtor_sync_runs` (mirrors `inventory_sync_runs` status vocabulary: running / success / failed / partial / paused / stopped).
- Nightly incremental: append `BridgeModificationTimestamp gt {watermark}` to filter (only in preset mode, not when `odata_filter_override` is set).

## Dependencies

- **Features:** `integrations-hub` (API key via `zillow` integration), `realtor-channel` (reads `mls_agent_leads`).
- **External:** Bridge Data Output RESO API (`https://api.bridgedataoutput.com`).
- **Env vars:** `SUPABASE_URL`, `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- **DB:** `integrations`, `integration_credentials`, `bridge_mls_sync_profiles`, `bridge_property_raw`, `mls_agent_leads`, `realtor_sync_runs`, `integration_api_logs`.

## How to navigate the code

- Shared utilities: `supabase/functions/_shared/bridge.ts` — start here for credentials, filter builder, OData paging, and agent mapper.
- Sync worker: `supabase/functions/bridge-mls-sync/index.ts` — main fan-out loop, upsert logic, background self-continue.
- Cron trigger: `supabase/functions/bridge-mls-cron/index.ts` — thin wrapper that fires incremental sync nightly.
- Profile management API: `supabase/functions/integrations-manage/index.ts` — search for `list_mls_profiles` action.
- Frontend service: `src/services/bridgeMls.ts` — all client-side calls to `integrations-manage` and `bridge-mls-sync`.
- Profile editor UI: `src/components/integrations/MlsProfilesPanel.tsx` — renders inside `IntegrationConfigPanel` when `slug === 'zillow'`.
- Sync controls UI: `src/components/ceo/MlsSyncControls.tsx`.
- Schema: `supabase/migrations/018_bridge_mls_sync.sql`.
- Cron schedule: `supabase/migrations/019_bridge_mls_cron.sql`.

## Filter precedence

1. If `odata_filter_override` is non-empty → use verbatim (incremental watermark NOT appended — CEO's responsibility).
2. Otherwise, build `(keyword OR condition) AND state_allowlist AND watermark`.

## Key design decision

Agent-primary data model: one row per `(dataset_id, list_agent_key)`. Multiple listings by the same agent increment `listing_count` and refresh `latest_*` fields when the newer listing has more DOM. This makes the realtor pitch queue actionable without cross-listing joins.
