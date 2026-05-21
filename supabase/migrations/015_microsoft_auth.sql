-- Microsoft Sign-In support
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS microsoft_id TEXT UNIQUE;
