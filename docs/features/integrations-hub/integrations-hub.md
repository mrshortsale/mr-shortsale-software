# Integrations hub

## Summary

CEO admin UI and Edge Functions to add integration records, store encrypted credentials, complete OAuth for providers that support it, and run connection tests. Feeds BatchLeads sync, AI agents, Zillow sync, and webhooks.

## Scope

**In scope:** Integrations page (`/ceo/integrations`), config panels, add-integration modal, API usage dashboard, `integrations-manage`, `integrations-oauth-callback`, `integrations-test`.

**Out of scope:** Per-provider sync workers (`batchleads-sync`, `zillow-sync`); user login OAuth (`user-auth`).

## Primary responsibilities

- CRUD integration definitions and encrypted secrets.
- OAuth callback handling for provider integrations.
- Health/test endpoints used from the UI.
- Client service wrapping Edge Function calls.

## Dependencies

- **Features:** `user-auth` (CEO role), `batchleads-sync`, `ai-agents`, `zillow-sync`, `webhook-ingestion`.
- **External:** Provider APIs (BatchLeads, OpenAI, Meta, etc. per configured integration).

## How to navigate the code

- UI: `src/components/integrations/IntegrationsPage.tsx`.
- Service: `src/services/integrations.ts`.
- Backend: `supabase/functions/integrations-*`.
- Stubs/reference clients: `src/integrations/`.

## Open questions / gaps

- `src/integrations/*` includes several demo or forward-looking clients (Realie, ATTOM, Mojo) that may not yet have full backend sync paths.
