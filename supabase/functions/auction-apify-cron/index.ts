/**
 * auction-apify-cron — Daily Auction.com sync trigger.
 *
 * Invoked by pg_cron via pg_net (see migration 032).
 * Skips if a sync is already in progress.
 */

function getServiceRoleKey(): string {
  return (Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

Deno.serve(async () => {
  const key = getServiceRoleKey();
  const baseUrl = Deno.env.get("SUPABASE_URL");

  if (!key || !key.startsWith("eyJ") || !baseUrl) {
    const msg =
      "Missing service role key or SUPABASE_URL. Configure VITE_SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets.";
    console.error("[auction-apify-cron]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const syncUrl = `${baseUrl}/functions/v1/auction-apify-sync`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
    "apikey": key,
  };

  try {
    const statusRes = await fetch(syncUrl, { method: "GET", headers });
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (status.syncInProgress) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "sync_already_running" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    } else {
      const errBody = await statusRes.text();
      console.warn(`[auction-apify-cron] status check failed ${statusRes.status}:`, errBody);
    }

    const syncRes = await fetch(syncUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "sync", _scheduledTrigger: true }),
    });

    const data = await syncRes.json();
    console.log(`[auction-apify-cron] triggered status=${syncRes.status}`, data);

    return new Response(
      JSON.stringify({ ok: syncRes.ok, ...data }),
      { status: syncRes.status, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[auction-apify-cron] failed:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
