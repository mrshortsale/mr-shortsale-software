# User authentication

## Summary

Sign-in and session management for CEO and rep roles: email/password, Google OAuth, and Microsoft OAuth. Issues and validates custom JWTs via Supabase Edge Functions; the SPA stores the token and restores the session on load.

## Scope

**In scope:** Login and signup forms, OAuth initiate/callback flows, JWT issuance and `auth-me` session restore, role embedded in token, demo quick-login cards on the login page.

**Out of scope:** User CRUD and approval workflows (see `user-management`); integration OAuth for third-party APIs (see `integrations-hub`).

## Primary responsibilities

- Validate credentials and return JWT (`auth-login`, `auth-signup`).
- Restore current user from token (`auth-me`).
- Google and Microsoft OAuth initiation and callback handlers.
- Client-side auth state (`AuthContext`) and protected route redirects in `App.tsx`.

## Dependencies

- **Features:** `app-shell` (routing and role redirects).
- **External:** Supabase (Postgres `users` table, Edge Functions).
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; server-side OAuth and JWT secrets in Supabase (not documented here).

## How to navigate the code

- UI: `src/pages/LoginPage.tsx`, `src/contexts/AuthContext.tsx`, `src/services/auth.ts`.
- OAuth buttons: `src/components/auth/`.
- Backend: `supabase/functions/auth-*` and `supabase/functions/_shared/jwt.ts`.

## Open questions / gaps

- User approval (`status`) is enforced on some APIs but not uniformly on all auth paths; align with `user-management` if tightening access.
