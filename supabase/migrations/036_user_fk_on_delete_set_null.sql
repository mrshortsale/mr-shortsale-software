-- Allow deleting users who configured integrations or triggered agent runs.
ALTER TABLE public.integration_credentials
  DROP CONSTRAINT IF EXISTS integration_credentials_configured_by_fkey;

ALTER TABLE public.integration_credentials
  ADD CONSTRAINT integration_credentials_configured_by_fkey
  FOREIGN KEY (configured_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_triggered_by_fkey;

ALTER TABLE public.agent_runs
  ADD CONSTRAINT agent_runs_triggered_by_fkey
  FOREIGN KEY (triggered_by) REFERENCES public.users(id) ON DELETE SET NULL;
