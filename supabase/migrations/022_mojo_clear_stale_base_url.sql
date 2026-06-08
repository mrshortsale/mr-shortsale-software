-- Clear stale Zapier seed from base_url so mojo-push uses encrypted zapierWebhookUrl.
-- Re-save the live Catch Hook URL in Integrations → Mojo Dialer after running this.
UPDATE public.integration_credentials ic
SET base_url = NULL
FROM public.integrations i
WHERE ic.integration_id = i.id
  AND i.slug = 'mojo-dialer'
  AND ic.base_url LIKE 'https://hooks.zapier.com/%';
