-- Integration catalog (built-in + custom)
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  icon_url TEXT,
  auth_method TEXT NOT NULL CHECK (auth_method IN (
    'api_key', 'basic_auth', 'oauth2', 'inbound_webhook', 'none'
  )),
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  default_base_url TEXT,
  health_check_endpoint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Encrypted credentials per integration instance
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('connected', 'disabled', 'error')),
  encrypted_credentials TEXT NOT NULL,
  credentials_iv TEXT NOT NULL,
  base_url TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_token_expires_at TIMESTAMPTZ,
  oauth_authorization_url TEXT,
  oauth_token_url TEXT,
  webhook_secret TEXT,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('success', 'failure')),
  last_test_error TEXT,
  configured_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-request API usage logging
CREATE TABLE IF NOT EXISTS public.integration_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id),
  credential_id UUID REFERENCES public.integration_credentials(id),
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INT,
  latency_ms INT,
  request_size_bytes INT,
  response_size_bytes INT,
  error_message TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_integration
  ON public.integration_api_logs(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_created
  ON public.integration_api_logs(created_at DESC);

-- Auto-update triggers (reuse existing set_updated_at function from 001)
DROP TRIGGER IF EXISTS integrations_set_updated_at ON public.integrations;
CREATE TRIGGER integrations_set_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS integration_credentials_set_updated_at ON public.integration_credentials;
CREATE TRIGGER integration_credentials_set_updated_at
  BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: deny all direct access (same pattern as users table)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_api_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integrations' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.integrations
        AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_credentials' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.integration_credentials
        AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_api_logs' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.integration_api_logs
        AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)
    $policy$;
  END IF;
END
$$;

-- Seed the 5 built-in integrations
INSERT INTO public.integrations (name, slug, description, category, auth_method, is_builtin, default_base_url, health_check_endpoint)
VALUES
  ('ATTOM Property Data', 'attom', 'Property valuation, equity calculation, and tax delinquency data from ATTOM.', 'data', 'api_key', true, 'https://api.gateway.attomdata.com', '/property/basicprofile'),
  ('Batch Leads', 'batchleads', 'Distressed property leads from 3,100+ counties via BatchLeads API.', 'data', 'api_key', true, 'https://api.batchleads.io', '/api/v1/health'),
  ('Zillow Listings', 'zillow', 'Short sale listings scraper feeding the realtor chain.', 'data', 'api_key', true, 'https://api.bridgedataoutput.com', '/api/v2/zestimates'),
  ('Meta Lead Ads', 'meta-ads', 'Webhook receiver for Facebook/Meta lead form fills.', 'marketing', 'inbound_webhook', true, NULL, NULL),
  ('Mojo Triple Dialer', 'mojo-dialer', 'Bulk dialing with call outcome sync via Mojo API.', 'communications', 'api_key', true, 'https://app.mojosells.com/api', '/status')
ON CONFLICT (slug) DO NOTHING;
