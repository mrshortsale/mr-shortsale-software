# User management (CEO admin)

## Summary

Lets the CEO list, create, update, and deactivate platform users (reps and additional CEO accounts). All mutations go through the `admin-users` Edge Function with server-side JWT role checks.

## Scope

**In scope:** User table UI, create/edit forms, soft deactivate, avatar color and role assignment.

**Out of scope:** Self-service profile settings (`ceo-settings` / general settings pages); authentication flows (`user-auth`).

## Primary responsibilities

- Display all users with role and active status.
- Create reps or CEO accounts with hashed passwords (server-side).
- Update name, email, password, role, and styling metadata.
- Prevent deleting the current CEO session user.

## Dependencies

- **Features:** `user-auth` (CEO JWT and role).
- **External:** Supabase Postgres `users` table.

## How to navigate the code

- UI: `src/components/ceo/UserManagement.tsx` (route `/ceo/users`).
- API: `supabase/functions/admin-users/index.ts`.

## Open questions / gaps

- `src/data/users.ts` may still seed demo personas; confirm UI always prefers live API data in production builds.
