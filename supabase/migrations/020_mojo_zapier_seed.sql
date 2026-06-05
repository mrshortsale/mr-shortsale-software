-- Migration: seed the Mojo Dialer Zapier catch-hook URL
-- The CEO can overwrite it on the Integrations page; this pre-seeds so it works immediately.

-- 1. Extend the auth_method check constraint to allow outbound_webhook
ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_auth_method_check;

ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_auth_method_check
    CHECK (auth_method IN (
      'api_key', 'basic_auth', 'oauth2', 'inbound_webhook', 'outbound_webhook', 'none'
    ));

-- 2. Flip mojo-dialer to outbound_webhook
UPDATE public.integrations
SET auth_method = 'outbound_webhook'
WHERE slug = 'mojo-dialer';

-- 3. Seed integration_credentials with the Zapier webhook URL stored in base_url.
--    encrypted_credentials / credentials_iv are empty because we use base_url as the direct URL.
--    When the CEO pastes and saves a new URL through the UI the row will be updated with
--    real encrypted_credentials and base_url will be cleared.
INSERT INTO public.integration_credentials (
  integration_id,
  status,
  encrypted_credentials,
  credentials_iv,
  base_url
)
SELECT
  i.id,
  'connected',
  '',  -- no encrypted payload; base_url is the authoritative URL for this seed
  '',
  'https://hooks.zapier.com/hooks/catch/19154304/4bedmu0/'
FROM public.integrations i
WHERE i.slug = 'mojo-dialer'
  AND NOT EXISTS (
    SELECT 1 FROM public.integration_credentials ic WHERE ic.integration_id = i.id
  );
