-- Remove the per-profile max_listings cap from Zillow Apify sync profiles.
-- The sync now processes every listing returned by the search actor.

ALTER TABLE public.zillow_apify_sync_profiles
  DROP COLUMN IF EXISTS max_listings;
