# County Data Sources

## Summary

County Data Sources gives CEO users an admin workflow for managing county foreclosure filing URLs, running scraper validation, and importing county-originated lis pendens leads into Lead Inventory.

## Scope

- In scope: county source CRUD, manual scrape runs, daily cron triggering, Firecrawl/OpenAI extraction, scrape history validation, and Lead Inventory source filtering.
- Out of scope: county-specific Apify actor execution beyond storing the actor ID, public access to scraper controls, and direct browser access to secrets.

## Primary responsibilities

- Store county scrape targets and scraper scheduling preferences.
- Run CEO-authorized county scrape jobs through Supabase Edge Functions.
- Capture run status, raw preview, sample records, and import counts for validation.
- Insert deduplicated county leads into inventory with `source='County'` and CountyScraper provenance.
- Let CEOs filter Lead Inventory by BatchLeads or County source.

## Dependencies

- Features: Lead Inventory, user authentication, round-robin rep assignment.
- External systems: Supabase Edge Functions, Supabase vault, Firecrawl, OpenAI.
- Env vars / secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `FIRECRAWL_API_KEY`, `OPENAI_API_KEY`.

## How to navigate the code

- Start with `src/pages/admin/DataSourcesPage.tsx` for the `/admin/data` UI, tables, modal, polling, and Run Now flow.
- Use `src/services/countyScraper.ts` and `src/types/countyScraper.ts` for the browser API contract.
- Use `supabase/functions/county-sources-manage/` for county source CRUD and run history reads.
- Use `supabase/functions/county-scraper-sync/` for Firecrawl/OpenAI extraction and inventory insertion.
- Use `supabase/functions/county-scraper-cron/` and `supabase/migrations/029_county_scraper_cron.sql` for daily scheduled runs.
- Lead Inventory source badges and filters live in `src/components/ceo/LeadInventory.tsx`; server filtering lives in `supabase/functions/inventory-leads/index.ts`.

## Open questions / gaps

- Apify execution is not implemented yet; current Apify support stores the actor ID so county sources can be marked for a future actor-based scraper path.
