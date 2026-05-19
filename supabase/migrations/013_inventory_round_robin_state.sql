-- Persistent round-robin cursor for auto-assigning Batch inventory leads to sales reps.
-- One row per scope (currently only 'batch_inventory').

CREATE TABLE IF NOT EXISTS public.inventory_round_robin_state (
  scope TEXT PRIMARY KEY DEFAULT 'batch_inventory',
  next_index INT NOT NULL DEFAULT 0 CHECK (next_index >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.inventory_round_robin_state (scope, next_index)
VALUES ('batch_inventory', 0)
ON CONFLICT (scope) DO NOTHING;

ALTER TABLE public.inventory_round_robin_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_round_robin_state'
      AND policyname = 'deny_all_direct_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "deny_all_direct_access" ON public.inventory_round_robin_state
        AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)
    $policy$;
  END IF;
END
$$;
