-- Track short-sale pipeline column per inventory lead (Active Pipeline kanban).
ALTER TABLE public.inventory_leads
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_leads_pipeline_stage_check'
  ) THEN
    ALTER TABLE public.inventory_leads
      ADD CONSTRAINT inventory_leads_pipeline_stage_check
      CHECK (
        pipeline_stage IS NULL
        OR pipeline_stage IN (
          'Initial Contact',
          'Docs Collected',
          'Bank Submitted',
          'Pending Approval'
        )
      );
  END IF;
END $$;

-- Active pipeline leads: contacted or promoted homeowners.
UPDATE public.inventory_leads
SET pipeline_stage = CASE
  WHEN status = 'Contacted' AND pipeline_stage IS NULL THEN 'Initial Contact'
  WHEN status = 'Promoted' AND pipeline_stage IS NULL THEN 'Bank Submitted'
  ELSE pipeline_stage
END
WHERE status IN ('Contacted', 'Promoted');

CREATE INDEX IF NOT EXISTS idx_inventory_leads_pipeline_stage
  ON public.inventory_leads(pipeline_stage)
  WHERE pipeline_stage IS NOT NULL AND status <> 'Dismissed';
