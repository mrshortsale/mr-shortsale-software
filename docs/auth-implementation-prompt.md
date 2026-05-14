# Authentication Module Implementation Prompt

> Paste this into a Cursor Agent mode chat to implement the full auth system.

---

Implement a full authentication system with a custom `users` table (NOT Supabase Auth built-in), sign-in, sign-up, form validation, password hashing via Supabase Edge Functions, and a CEO-only user management module. Replace the current hardcoded mock auth entirely.

The Supabase client is already configured at `src/integrations/supabase/client.ts` and reads from env vars. The Supabase project ID is `abpxitlgresjdiwpmzbb`.

---

## PART 1 — Database: custom `users` table + RLS

Create `supabase/migrations/001_create_users_table.sql`.

We are NOT using Supabase's `auth.users` or `supabase.auth.signInWithPassword()`. We manage our own `public.users` table with hashed passwords and issue/verify JWTs ourselves via Edge Functions.

### Table: `public.users`

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'rep' CHECK (role IN ('ceo', 'rep')),
  avatar_color TEXT NOT NULL DEFAULT '#185FA5',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Create a trigger that auto-sets `updated_at = now()` on every UPDATE.
- Create a unique index on `LOWER(email)` to enforce case-insensitive uniqueness.
- Enable RLS on `public.users`.
- For now, add a permissive policy that allows the Edge Functions (using the `service_role` key) to do everything. The frontend will never query this table directly — all reads/writes go through Edge Functions that validate the session.

### Seed data

Create `supabase/seed.sql` that inserts the 4 demo users. Use the pgcrypto `crypt()` function to hash the password `demo2026`:

| email | name | role | avatar_color |
|-------|------|------|-------------|
| cristina@mrshortsale.net | Cristina Gaspar | ceo | #042C53 |
| maria@mrshortsale.net | Maria Santos | rep | #0F6E56 |
| james@mrshortsale.net | James Rivera | rep | #185FA5 |
| luis@mrshortsale.net | Luis Ortega | rep | #854F0B |

---

## PART 2 — Edge Functions for auth

All auth logic lives in Supabase Edge Functions (Deno). The frontend NEVER sees `password_hash` or the `service_role` key. Create these three Edge Functions:

### 2a. `supabase/functions/auth-login/index.ts`

- POST `{ email, password }`
- Query `public.users` where `LOWER(email) = LOWER(input)` and `is_active = true`
- Verify password using pgcrypto `crypt(password, password_hash) = password_hash`
- If valid: generate a JWT (use jose or djwt Deno library) containing `{ sub: user.id, email: user.email, role: user.role }` signed with a `JWT_SECRET` env var. Set expiry to 7 days.
- Update `last_login_at` on the user row.
- Return `{ token, user: { id, email, name, role, avatarColor } }`
- If invalid: return 401 with `{ error: "Invalid email or password" }`
- Add proper CORS headers.

### 2b. `supabase/functions/auth-signup/index.ts`

- POST `{ email, password, name }`
- Validate: email format, password min 8 chars + at least one uppercase + one number, name min 2 chars
- Check if email already exists in `public.users` — if so return 409 `{ error: "Email already registered" }`
- Hash password with pgcrypto `crypt(password, gen_salt('bf'))`
- Insert into `public.users` with `role = 'rep'` (new signups are always reps)
- Generate a JWT same as login
- Return `{ token, user: { id, email, name, role, avatarColor } }`
- Add proper CORS headers.

### 2c. `supabase/functions/auth-me/index.ts`

- GET with `Authorization: Bearer <token>` header
- Verify and decode the JWT
- Fetch the user from `public.users` by `id` (from JWT `sub` claim)
- If user not found or `is_active = false`, return 401
- Return `{ user: { id, email, name, role, avatarColor } }`
- This is used to restore sessions on page refresh.
- Add proper CORS headers.

### Shared JWT utility

Create `supabase/functions/_shared/jwt.ts` with:
- `signJwt(payload, secret, expiresInDays)` → token string
- `verifyJwt(token, secret)` → payload or throw
- Both functions use the `jose` library (import from `https://deno.land/x/jose/`)
- The `JWT_SECRET` is read from `Deno.env.get('JWT_SECRET')`

Add `JWT_SECRET` to the `.env` and `.env.example` files:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
JWT_SECRET=your-jwt-secret-min-32-chars
```

---

## PART 3 — Frontend auth service (`src/services/auth.ts`)

Create a new file `src/services/auth.ts` that wraps all calls to the Edge Functions:

```ts
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ceo' | 'rep';
  avatarColor: string;
}

interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

async function login(email: string, password: string): Promise<AuthResponse>
async function signup(email: string, password: string, name: string): Promise<AuthResponse>
async function getMe(token: string): Promise<AuthResponse>
```

- The base URL for edge functions is `${VITE_SUPABASE_URL}/functions/v1/`
- Store the JWT token in `localStorage` under key `mrs_token`
- Include `Authorization: Bearer <anon_key>` AND a custom header `X-Auth-Token: <jwt>` for authenticated requests, OR use the anon key as the Authorization and pass the JWT in the body/header as the edge function expects.
- Handle network errors gracefully — return `{ success: false, error: "Network error" }`

---

## PART 4 — Auth Context rewrite (`src/contexts/AuthContext.tsx`)

Replace the entire current implementation. The new AuthContext must:

- On mount: check `localStorage` for `mrs_token`. If found, call `getMe(token)` to restore the session. Set `loading = true` during this check.
- `login(email, password)` → calls the auth service, stores token, sets user
- `signup(email, password, name)` → calls the auth service, stores token, sets user
- `logout()` → clears token from localStorage, sets user to null
- If `getMe()` returns `is_active = false` or 401, clear the token and set user to null.

Expose this interface:

```ts
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}
```

The `User` type MUST keep this exact shape (used across the entire app):

```ts
interface User {
  id: string;
  email: string;
  name: string;
  role: 'ceo' | 'rep';
  avatarColor: string;
}
```

Remove the import from `@/data/users`. Do NOT delete `src/data/users.ts` — other files use its user list for assigning mock lead data.

---

## PART 5 — Login page rewrite (`src/pages/LoginPage.tsx`)

Redesign the login page with two modes — **Sign In** and **Sign Up** — toggled by a link at the bottom of each form.

### Sign In form

- Fields: Email, Password
- Validation with Zod + react-hook-form:
  - Email: required, valid email format
  - Password: required, min 6 characters
- Show field-level validation errors inline below each field using `FormMessage`
- Show Supabase/server errors (wrong password, user not found, account deactivated, etc.) as a destructive banner above the form
- Submit button shows a loading spinner (lucide `Loader2` with `animate-spin`) while the request is in flight, and is disabled during loading

### Sign Up form

- Fields: Full Name, Email, Password, Confirm Password
- Validation with Zod + react-hook-form:
  - Name: required, min 2 characters
  - Email: required, valid email format
  - Password: required, min 8 characters, must contain at least one uppercase letter and one number
  - Confirm Password: must match Password (use Zod `.refine()`)
- Role is NOT selectable during sign-up — all new users default to 'rep'. Only CEO can change roles via user management.
- On success: auto-login (the signup edge function returns a JWT), redirect into the app
- Submit button shows a loading spinner while the request is in flight

### Design

- Keep the existing visual style: gradient background (`from-slate-50 via-blue-50 to-slate-100`), glassmorphism card (`bg-white/80 backdrop-blur-xl rounded-3xl`), logo at top
- Use shadcn/ui `Input`, `Button`, `Label` components from `src/components/ui/`
- Use `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `src/components/ui/form.tsx`
- Use `@hookform/resolvers/zod` for Zod resolver (already installed)
- Keep the "Quick Login" demo account cards BELOW the sign-in form — they call `login()` with pre-filled credentials. Hide them on the sign-up view.
- Toggle text: "Don't have an account? Sign up" / "Already have an account? Sign in"

---

## PART 6 — App.tsx loading state

Update `src/App.tsx` `AppShell` component:

- Destructure `loading` from `useAuth()`
- While `loading` is true, render a full-screen centered spinner: the app's background color with a `Loader2` icon (from lucide-react) spinning in the center
- Once loading resolves, show LoginPage / CEODashboard / RepDashboard based on user/role as before

---

## PART 7 — User Management module (CEO only)

Create `src/components/ceo/UserManagement.tsx` — a full user CRUD interface accessible only to the CEO.

### 7a. User list

- Fetch all users from a new edge function `supabase/functions/admin-users/index.ts` (GET → returns all users, excluding `password_hash`)
- Display in a table using shadcn/ui `Table` components from `src/components/ui/table.tsx`
- Columns: Avatar (colored circle with first letter of name), Name, Email, Role (badge — blue for CEO, green for rep), Status (green dot for active, gray for inactive), Created date (formatted with date-fns)
- Search/filter input above the table to filter by name or email
- Sort by name alphabetically by default

### 7b. Invite / Add user dialog

- Opens in a shadcn/ui `Dialog` from `src/components/ui/dialog.tsx`
- Fields: Full Name, Email, Temporary Password, Role (shadcn `Select` dropdown: 'ceo' or 'rep'), Avatar Color (6 preset color swatches to pick from)
- Validation with Zod: name required min 2 chars, email required + valid format, password required min 8 chars, role required
- On submit: POST to `admin-users` edge function with `action: 'create'`
- The edge function hashes the password and inserts into `public.users`
- On success: close dialog, refetch user list, show success toast via `sonner`

### 7c. Edit user dialog

- Same dialog layout, pre-filled with existing user data
- CEO can change: Name, Role, Avatar Color, Active status (toggle switch)
- Password field is optional — if left blank, password is not changed. If filled, the edge function hashes and updates it.
- On submit: POST to `admin-users` edge function with `action: 'update'`
- On success: close dialog, refetch user list, show success toast

### 7d. Delete user

- Trash icon button on each row (disabled on the CEO's own row — cannot delete yourself)
- Opens a shadcn/ui `AlertDialog` confirmation: "Are you sure you want to delete [name]? This action cannot be undone."
- On confirm: POST to `admin-users` edge function with `action: 'delete'`
- On success: refetch user list, show toast

### 7e. `supabase/functions/admin-users/index.ts` Edge Function

- Verifies the JWT from the request, confirms the caller's role is 'ceo' by querying `public.users`
- Actions:
  - GET (no action field): return all users (id, email, name, role, avatar_color, is_active, last_login_at, created_at) — NEVER return password_hash
  - POST `{ action: 'create', email, name, password, role, avatarColor }`: hash password, insert into `public.users`
  - POST `{ action: 'update', userId, name?, role?, avatarColor?, isActive?, password? }`: update fields on `public.users`. If password provided, hash it.
  - POST `{ action: 'delete', userId }`: delete from `public.users`. Prevent deleting the caller's own row.
- Use the shared `_shared/jwt.ts` for token verification
- Add proper CORS headers

### Wire into CEO Dashboard

In `src/pages/CEODashboard.tsx`:
- Import UserManagement
- Add nav item under the existing "Admin" divider (before "Data Sources"): `{ id: 'users', label: 'User Management', icon: Users }`
- Add case in `renderContent()`: `case 'users': return <UserManagement />;`
- The `Users` icon from lucide-react is already imported in CEODashboard.tsx

---

## CONSTRAINTS — READ CAREFULLY

1. **No Supabase Auth built-in** — do NOT use `supabase.auth.signIn`, `supabase.auth.signUp`, `supabase.auth.onAuthStateChange`, or any `auth.users` table. All auth is our own custom `public.users` table + Edge Functions + our own JWTs.

2. **User interface compatibility** — the `User` type `{ id, email, name, role, avatarColor }` is consumed by: `App.tsx`, `CEODashboard.tsx`, `RepDashboard.tsx`, `LoginPage.tsx`, and all components under `src/components/rep/` that call `useAuth()`. Do NOT change this shape.

3. **Role-based routing** — `AppShell` in `App.tsx` uses `user.role === 'ceo'` to pick the dashboard. This must keep working.

4. **Do NOT touch** `src/pages/Proposal.tsx` or `src/pages/Costs.tsx` — they are public pages with no auth.

5. **Do NOT delete** `src/data/users.ts` — it's still used by `src/data/leads.ts`, `src/data/pipeline.ts`, and `src/data/calls.ts` for mock data assignment.

6. **Use existing packages only** — `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`, `date-fns`, and all shadcn/ui components are already installed. Do NOT add new npm dependencies.

7. **Edge Functions use Deno** — imports use URL-based imports (e.g., `https://deno.land/x/jose/`). Use the Supabase service-role client within edge functions to query the database.

8. **CORS** — all edge functions must return proper CORS headers allowing the frontend origin. Handle OPTIONS preflight requests.
