-- Extend public.inventory_leads to support the new Batch-only Lead Inventory spec.
-- Adds qualification, dedup, assignment, and contact-tracking columns.
-- All new columns are nullable (or have safe defaults) so existing rows remain valid.

BEGIN;

-- 1. Add the new columns ------------------------------------------------------

ALTER TABLE public.inventory_leads
  ADD COLUMN IF NOT EXISTS apn TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS filing_type TEXT,
  ADD COLUMN IF NOT EXISTS lead_type TEXT NOT NULL DEFAULT 'Homeowner',
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ltv_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS assigned_rep_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outcome TEXT,
  ADD COLUMN IF NOT EXISTS normalized_address TEXT;

-- 2. Add CHECK constraints (added separately so IF NOT EXISTS on columns is safe)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_leads_filing_type_check'
  ) THEN
    ALTER TABLE public.inventory_leads
      ADD CONSTRAINT inventory_leads_filing_type_check
      CHECK (filing_type IS NULL OR filing_type IN ('NOD', 'NTS', 'LP', 'Short Sale', 'Inbound', 'REO', 'Other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_leads_lead_type_check'
  ) THEN
    ALTER TABLE public.inventory_leads
      ADD CONSTRAINT inventory_leads_lead_type_check
      CHECK (lead_type IN ('Homeowner', 'Realtor', 'Inbound'));
  END IF;
END
$$;

-- 3. Replace the status CHECK: 'Triaged' -> 'Contacted' ----------------------

UPDATE public.inventory_leads SET status = 'Contacted' WHERE status = 'Triaged';

ALTER TABLE public.inventory_leads
  DROP CONSTRAINT IF EXISTS inventory_leads_status_check;

ALTER TABLE public.inventory_leads
  ADD CONSTRAINT inventory_leads_status_check
  CHECK (status IN ('New', 'Contacted', 'Promoted', 'Dismissed'));

-- 4. Backfill ingested_at and lead_type for existing rows ---------------------

UPDATE public.inventory_leads
SET ingested_at = COALESCE(synced_at, received_at, now())
WHERE ingested_at = '1970-01-01T00:00:00Z'
   OR ingested_at IS NULL
   OR ingested_at < COALESCE(synced_at, received_at, ingested_at);

UPDATE public.inventory_leads
SET lead_type = 'Homeowner'
WHERE lead_type IS NULL;

-- 5. Indexes ------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_inventory_leads_apn
  ON public.inventory_leads(source, apn)
  WHERE apn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_leads_filing_type
  ON public.inventory_leads(filing_type);

CREATE INDEX IF NOT EXISTS idx_inventory_leads_equity_pct
  ON public.inventory_leads(equity_pct);

CREATE INDEX IF NOT EXISTS idx_inventory_leads_ingested_at
  ON public.inventory_leads(ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_leads_assigned_rep
  ON public.inventory_leads(assigned_rep_id)
  WHERE assigned_rep_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_leads_status
  ON public.inventory_leads(status);

CREATE INDEX IF NOT EXISTS idx_inventory_leads_normalized_address
  ON public.inventory_leads(normalized_address)
  WHERE normalized_address IS NOT NULL;

COMMIT;
