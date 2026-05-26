# Webhook ingestion

## Summary

Public Edge Function endpoint that accepts signed inbound webhooks (Meta `leadgen` and generic HMAC providers), resolves the integration by URL slug, verifies signatures, and ingests leads into the platform.

## Scope

**In scope:** `webhook-receiver` function, signature verification helpers.

**Out of scope:** Meta Ads UI configuration (`integrations-hub`); CEO-facing lead review (`lead-inventory`).

## Primary responsibilities

- Route requests by integration slug in the path.
- Verify Meta `X-Hub-Signature-256` or generic HMAC.
- Parse payload and persist inbound leads.

## Dependencies

- **Features:** `integrations-hub` (webhook secrets), `lead-inventory` (downstream storage).
- **External:** Meta Lead Ads, other webhook senders.

## How to navigate the code

- `supabase/functions/webhook-receiver/index.ts`

## Open questions / gaps

- Document expected slug URL format for each deployed integration in ops runbooks (not secrets).
