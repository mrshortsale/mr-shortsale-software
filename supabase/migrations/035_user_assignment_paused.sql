-- Pause a sales rep from round-robin lead assignment (vacation / sick)
-- without deactivating their account or reassigning existing leads.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS assignment_paused BOOLEAN NOT NULL DEFAULT false;
