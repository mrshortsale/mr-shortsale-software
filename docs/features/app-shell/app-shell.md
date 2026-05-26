# Application shell

## Summary

Core SPA infrastructure: React Router setup, CEO and rep layouts with sidebar navigation, global providers (auth, theme, app state), and internationalization. Routes unauthenticated users to login and routes authenticated users by role.

## Scope

**In scope:** `BrowserRouter`, `CEOLayout` / `RepLayout`, sidebar and top nav, theme toggle, i18n resources, 404 page, home redirect by role.

**Out of scope:** Feature-specific page content (mapped to individual CEO/rep feature slugs); shadcn/ui primitives (shared design system under `src/components/ui/`).

## Primary responsibilities

- Mount providers and global toasters.
- Define CEO (`/ceo/*`) and rep (`/rep/*`) route trees.
- Render navigation from `ceoNav.ts` and `repNav.ts`.
- Hold cross-cutting UI state (e.g. active call) in `AppContext`.

## Dependencies

- **Features:** `user-auth` (session and role for redirects).
- **External:** Vite, React Router, i18next, Tailwind.

## How to navigate the code

- Entry: `src/main.tsx` → `src/App.tsx`.
- Layouts: `src/layouts/CEOLayout.tsx`, `src/layouts/RepLayout.tsx`.
- Nav config: `src/config/ceoNav.ts`, `src/config/repNav.ts`.

## Open questions / gaps

- Legacy page components `CEODashboard.tsx` and `RepDashboard.tsx` may be unused if all routes nest under layouts; safe to deprecate when confirmed.
