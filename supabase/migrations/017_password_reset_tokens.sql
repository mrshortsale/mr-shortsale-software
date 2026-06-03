-- Password reset tokens for forgot-password flow
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx
  ON public.password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON public.password_reset_tokens (user_id);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'password_reset_tokens'
      AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.password_reset_tokens
        AS RESTRICTIVE
        FOR ALL
        TO anon, authenticated
        USING (false)
    $policy$;
  END IF;
END
$$;
