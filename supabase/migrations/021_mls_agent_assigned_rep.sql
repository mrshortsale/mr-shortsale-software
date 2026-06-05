-- Add rep assignment column to mls_agent_leads
ALTER TABLE public.mls_agent_leads
  ADD COLUMN IF NOT EXISTS assigned_rep TEXT;
