/**
 * batchleads-cron — Nightly incremental sync trigger.
 *
 * Invoked by pg_cron via pg_net (see migration 011).
 * Calls batchleads-sync with the service role key and _scheduledTrigger: true.
 */

function getServiceRoleKey(): string {
  return (Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

Deno.serve(async () => {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/batchleads-sync`;
  const key = getServiceRoleKey();

  if (!key || !key.startsWith("eyJ")) {
    const msg =
      "Missing service role key. Add VITE_SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY) " +
      "to Edge Function secrets in the Supabase Dashboard (Settings → API → service_role).";
    console.error("[batchleads-cron]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
    "apikey": key,
  };

  try {
    const statusRes = await fetch(url, { method: "GET", headers });

    let mode: "incremental" | "full" = "full";
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (status.hasIncrementalBaseline) mode = "incremental";
      if (status.syncInProgress) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "sync_already_running" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    } else {
      const errBody = await statusRes.text();
      console.warn(`[batchleads-cron] status check failed ${statusRes.status}:`, errBody);
    }

    const syncRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "sync",
        mode,
        background: true,
        _scheduledTrigger: true,
      }),
    });

    const data = await syncRes.json();
    console.log(`[batchleads-cron] triggered mode=${mode} status=${syncRes.status}`, data);

    return new Response(
      JSON.stringify({ ok: syncRes.ok, mode, ...data }),
      { status: syncRes.status, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[batchleads-cron] failed:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
