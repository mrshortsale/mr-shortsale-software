-- Round-robin cursor for auto-assigning Bridge MLS realtor leads to sales reps.
INSERT INTO public.inventory_round_robin_state (scope, next_index)
VALUES ('realtor_mls', 0)
ON CONFLICT (scope) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_assigned_rep
  ON public.mls_agent_leads(assigned_rep)
  WHERE assigned_rep IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mls_agent_leads_unassigned
  ON public.mls_agent_leads(created_at)
  WHERE assigned_rep IS NULL;
