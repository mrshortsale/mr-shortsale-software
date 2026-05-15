-- CEO lead inventory: synced leads from external sources (Batch Leads first)

CREATE TABLE IF NOT EXISTS public.inventory_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'Batch',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  lists_processed INT NOT NULL DEFAULT 0,
  leads_upserted INT NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_inventory_sync_runs_source_started
  ON public.inventory_sync_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_leads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'Batch',
  external_id TEXT NOT NULL,
  batch_list_id INT,
  batch_list_name TEXT,
  owner TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  county TEXT NOT NULL DEFAULT '',
  equity_pct INT NOT NULL DEFAULT 0,
  days_to_auction INT NOT NULL DEFAULT 999,
  score INT NOT NULL DEFAULT 5,
  language TEXT NOT NULL DEFAULT 'EN' CHECK (language IN ('EN', 'ES')),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Triaged', 'Promoted', 'Dismissed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_leads_source ON public.inventory_leads(source);
CREATE INDEX IF NOT EXISTS idx_inventory_leads_state ON public.inventory_leads(state);
CREATE INDEX IF NOT EXISTS idx_inventory_leads_score ON public.inventory_leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_leads_received ON public.inventory_leads(received_at DESC);

ALTER TABLE public.inventory_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_sync_runs' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.inventory_sync_runs
        AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_leads' AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.inventory_leads
        AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)
    $policy$;
  END IF;
END
$$;
