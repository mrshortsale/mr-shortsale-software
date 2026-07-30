-- Stop daily Auction.com Apify cron. Sync remains available via manual UI trigger
-- (auction-apify-sync). Job was scheduled in 032_auction_apify.sql.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auction-apify-daily') THEN
    PERFORM cron.unschedule('auction-apify-daily');
  END IF;
END
$$;
