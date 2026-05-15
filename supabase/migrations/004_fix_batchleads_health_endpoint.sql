-- Batch Leads: https://developer.batchservice.com/docs/batchleads — GET /api/v1/tags, header api-key
UPDATE public.integrations
SET
  default_base_url = 'https://app.batchleads.io',
  health_check_endpoint = '/api/v1/tags'
WHERE slug = 'batchleads';
