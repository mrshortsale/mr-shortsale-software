-- New inventory leads belong on Active Pipeline in Initial Contact.
UPDATE public.inventory_leads
SET pipeline_stage = 'Initial Contact'
WHERE status = 'New' AND pipeline_stage IS NULL;
