-- Google Sign-In support
-- 1. Allow Google-only users who have no password
-- 2. Store the Google subject identifier for account linking

ALTER TABLE public.users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
