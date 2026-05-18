-- Add approval status to users table
-- 'pending' = awaiting CEO approval (self-signup or CEO-created without immediate approval)
-- 'active'  = approved and can log in
-- 'rejected' = denied; cannot log in or re-register with same email
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('pending', 'active', 'rejected'));

-- All existing users remain login-capable
UPDATE public.users SET status = 'active' WHERE status IS NULL OR status = 'active';
