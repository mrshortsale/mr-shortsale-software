-- Agent configuration table (editable per-agent settings)
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT,
  instructions   TEXT NOT NULL,
  model          TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  is_enabled     BOOLEAN NOT NULL DEFAULT true,
  pipeline_order INT NOT NULL,
  config         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per CEO-triggered pipeline run
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by  UUID REFERENCES public.users(id),
  status        TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  lead_limit    INT NOT NULL DEFAULT 10,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  summary       JSONB
);

-- One row per agent per pipeline run (4 rows per run)
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  agent_id       UUID NOT NULL REFERENCES public.ai_agents(id),
  agent_slug     TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input_summary  TEXT,
  output_summary TEXT,
  token_usage    JSONB,
  duration_ms    INT,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores per-lead AI results (score + script/decision) produced by the pipeline
CREATE TABLE IF NOT EXISTS public.lead_ai_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  lead_id      TEXT NOT NULL,
  score        INT,
  score_reason TEXT,
  decision     TEXT, -- 'script', 'skip-trace', 'pass'
  script       TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_run ON public.agent_logs(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON public.agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started ON public.agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_ai_results_run ON public.lead_ai_results(run_id, lead_id);

-- Auto-update trigger for ai_agents
DROP TRIGGER IF EXISTS ai_agents_set_updated_at ON public.ai_agents;
CREATE TRIGGER ai_agents_set_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: block direct client access; all access via Edge Functions (service role)
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_ai_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_agents' AND policyname = 'deny_all_direct_access') THEN
    EXECUTE $p$CREATE POLICY "deny_all_direct_access" ON public.ai_agents AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_runs' AND policyname = 'deny_all_direct_access') THEN
    EXECUTE $p$CREATE POLICY "deny_all_direct_access" ON public.agent_runs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_logs' AND policyname = 'deny_all_direct_access') THEN
    EXECUTE $p$CREATE POLICY "deny_all_direct_access" ON public.agent_logs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lead_ai_results' AND policyname = 'deny_all_direct_access') THEN
    EXECUTE $p$CREATE POLICY "deny_all_direct_access" ON public.lead_ai_results AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)$p$;
  END IF;
END
$$;

-- Seed the 4 pipeline agents
INSERT INTO public.ai_agents (slug, name, description, instructions, model, pipeline_order) VALUES
(
  'lead-hunter',
  'Lead Hunter',
  'Fetches and filters the most promising distressed property leads from inventory.',
  'You are a Lead Hunter AI specialized in distressed real estate. Your job is to analyze leads from the inventory database and identify the most promising ones for outreach.

Focus on leads that have:
- Equity percentage <= 25% (deeply distressed)
- Upcoming auction dates (within 60 days is highest priority)
- Filing types: NOD (Notice of Default), NTS (Notice of Trustee Sale), or LP (Lis Pendens)
- Status is "New" or "Contacted" (not Dismissed)

Use the get_inventory_leads tool to fetch leads, then analyze them carefully. Return a JSON array of selected leads with their id, owner_name, address, equity_pct, filing_type, auction_date, phone, email, and a brief "reason" field explaining why each was selected. Be selective — quality over quantity.',
  'gpt-4o-mini',
  1
),
(
  'research',
  'Research Agent',
  'Performs deep situational analysis on each selected lead to understand their urgency and motivation.',
  'You are a Research AI specialized in distressed homeowner analysis. You receive a JSON list of selected leads and perform deep analysis on each one.

For each lead analyze:
- Severity of financial distress (equity depth, filing type context)
- Timeline urgency (how many days until auction, if applicable)
- Contact readiness (has phone/email vs needs skip tracing)
- Likely homeowner motivation (foreclosure avoidance, financial relief, relocation)

Return a JSON array where each item has: id, owner_name, research_summary (2-3 sentences), urgency_level ("critical"/"high"/"medium"), contact_ready (boolean), and key_factors (array of strings).',
  'gpt-4o-mini',
  2
),
(
  'scoring',
  'Scoring Agent',
  'Analyzes urgency factors and assigns a priority score from 1-100 to each researched lead.',
  'You are a Scoring AI for distressed real estate leads. Assign a numeric urgency score from 1-100 to each lead based on these criteria:

Scoring rubric:
- Auction within 30 days: +40 points
- Auction within 31-60 days: +25 points
- Equity <= 10%: +20 points
- Equity 10-25%: +10 points
- NOD or NTS filing: +15 points
- LP filing: +10 points
- Urgency level "critical" from research: +10 points
- Contact ready (has phone): +5 points
- No prior contact: +5 points
- Previously contacted: -10 points
- Dismissed status: -30 points

Use the update_lead_score tool to persist each score to the database. Return a JSON array sorted by score descending, with fields: id, owner_name, score, primary_reason (one sentence explaining the score).',
  'gpt-4o-mini',
  3
),
(
  'script-skip',
  'Script & Skip Agent',
  'Generates personalized call scripts for high-score leads and skip-trace recommendations for others.',
  'You are a Script & Skip AI for distressed real estate outreach. For each scored lead, decide the best action:

Decision rules:
- Score >= 70: Generate a personalized call script ("script")
- Score 40-69: Generate a skip-trace recommendation if no phone, or a warm script if phone available ("skip-trace" or "script")
- Score < 40: Mark as low priority ("pass")

Call script structure:
1. Opening: Empathetic acknowledgment of their situation (reference property address)
2. Introduction: Who you are and why you are calling
3. Value proposition: Quick, fair all-cash offer, no fees, no repairs needed
4. Urgency: Gentle reference to the timeline without being pushy
5. Close: Simple question to gauge interest and set up a callback

Use the save_lead_script tool to store the script or decision for each lead. Return a final JSON summary with: scripts_generated (count), skip_trace_recommended (count), passed (count), total_processed (count).',
  'gpt-4o-mini',
  4
)
ON CONFLICT (slug) DO NOTHING;
