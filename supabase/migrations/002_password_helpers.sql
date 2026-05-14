-- RPC helper: verify a plaintext password against a bcrypt hash
-- pgcrypto lives in the extensions schema on Supabase
CREATE OR REPLACE FUNCTION public.verify_password(input_password TEXT, stored_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT crypt(input_password, stored_hash) = stored_hash;
$$;

-- RPC helper: hash a plaintext password with bcrypt
CREATE OR REPLACE FUNCTION public.hash_password(input_password TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT crypt(input_password, gen_salt('bf'));
$$;

-- Restrict execution to service_role only (edge functions)
REVOKE ALL ON FUNCTION public.verify_password(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hash_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO service_role;
