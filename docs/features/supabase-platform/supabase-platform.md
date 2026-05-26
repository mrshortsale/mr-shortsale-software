# Supabase platform layer

## Summary

Cross-cutting backend infrastructure: Postgres migrations, local/remote Supabase config, shared Edge Function utilities (CORS, JWT, email, crypto), generated types, and the browser Supabase client.

## Scope

**In scope:** Everything under `supabase/` except feature-specific function folders already mapped to other slugs; `src/integrations/supabase/`.

**Out of scope:** Business logic inside individual Edge Functions (see feature-specific slugs).

## Primary responsibilities

- Evolve database schema via numbered migrations.
- Provide shared Deno helpers for all Edge Functions.
- Expose typed client for frontend (`client.ts`, `types.ts`).

## Dependencies

- **External:** Supabase project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, service role on server).

## How to navigate the code

- Migrations: `supabase/migrations/`.
- Shared libs: `supabase/functions/_shared/`.
- Frontend client: `src/integrations/supabase/client.ts`.

## Open questions / gaps

- Regenerate `types.ts` when migrations change if using Supabase codegen in CI.
