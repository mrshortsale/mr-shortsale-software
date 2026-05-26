# Mojo dialer view

## Summary

Placeholder and future integration surface for Mojo Power Dialer on the CEO operations menu (`/ceo/dialer`). Intended to show live dial sessions and stats when connected.

## Scope

**In scope:** `MojoDialerScreen.tsx`, `mojoDialer.ts` client stub.

**Out of scope:** Rep active call UI (`rep-workspace`).

## Primary responsibilities

- Present dialer-oriented KPIs and session state (planned).
- Bridge to Mojo API when credentials exist in integrations.

## Dependencies

- **Features:** `integrations-hub` (future Mojo credentials).
- **External:** Mojo Power Dialer API.

## How to navigate the code

- `src/components/ceo/MojoDialerScreen.tsx`
- `src/integrations/mojoDialer.ts`

## Open questions / gaps

- No Edge Function sync yet; treat as forward-looking unless Mojo API is wired.
