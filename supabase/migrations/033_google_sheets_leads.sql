-- Google Sheets speed-to-lead: round-robin scope, integration catalog entry, query index.

BEGIN;

INSERT INTO public.inventory_round_robin_state (scope, next_index)
VALUES ('google_sheets', 0)
ON CONFLICT (scope) DO NOTHING;

INSERT INTO public.integrations (name, slug, description, category, auth_method, is_builtin, default_base_url, health_check_endpoint)
VALUES (
  'Google Sheets Leads',
  'google-sheets',
  'Inbound leads from Google Sheets tabs via Zapier webhooks (AD Leads, New Campaign, Updated Leads, realtors).',
  'data',
  'none',
  true,
  NULL,
  NULL
)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_inventory_leads_sheets_tab_received
  ON public.inventory_leads(source, data_source, received_at DESC)
  WHERE source = 'GoogleSheets';

COMMIT;
