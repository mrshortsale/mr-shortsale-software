# Marketing pages

## Summary

Unauthenticated public routes for client-facing collateral: the platform proposal (`/proposal`) and cost / ROI transparency (`/costs`). Linked from the CEO sidebar as external entries.

## Scope

**In scope:** `Proposal.tsx`, `Costs.tsx`, routes in `App.tsx`.

**Out of scope:** Authenticated CEO presentation mode (`ceo-strategy-views`).

## Primary responsibilities

- Present value proposition and pricing without login.
- Support sales workflow alongside in-app presentation.

## Dependencies

- **Features:** `app-shell` (routing only).

## How to navigate the code

- `src/pages/Proposal.tsx`, `src/pages/Costs.tsx`
- Routes: `src/App.tsx` (`/proposal`, `/costs`)

## Open questions / gaps

- Content may be static; consider CMS or markdown source if copy changes often.
