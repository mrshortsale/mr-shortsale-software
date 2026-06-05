/**
 * bridge-mls-cron — Nightly incremental sync trigger for all enabled MLS profiles.
 *
 * Invoked by pg_cron via pg_net (see migration 019_bridge_mls_cron.sql).
 * Fires bridge-mls-sync with _scheduledTrigger: true so it bypasses CEO auth.
 */

function getServiceRoleKey(): string {
  return (Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

Deno.serve(async () => {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bridge-mls-sync`;
  const key = getServiceRoleKey();

  if (!key || !key.startsWith("eyJ")) {
    const msg =
      "Missing service role key. Add VITE_SUPABASE_SERVICE_ROLE_KEY " +
      "to Edge Function secrets in the Supabase Dashboard (Settings → API → service_role).";
    console.error("[bridge-mls-cron]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
  };

  try {
    // Check current status — skip if any profile is already syncing
    const statusRes = await fetch(url, { method: "GET", headers });
    if (statusRes.ok) {
      const status = await statusRes.json() as { profiles?: Array<{ syncInProgress: boolean }> };
      const anyRunning = status.profiles?.some((p) => p.syncInProgress) ?? false;
      if (anyRunning) {
        console.log("[bridge-mls-cron] skipped — sync already in progress");
        return new Response(
          JSON.stringify({ skipped: true, reason: "sync_already_running" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    } else {
      console.warn("[bridge-mls-cron] status check failed:", statusRes.status);
    }

    // Trigger incremental sync for all enabled profiles in background
    const syncRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "sync",
        mode: "incremental",
        background: true,
        _scheduledTrigger: true,
      }),
    });

    const data = await syncRes.json();
    console.log(`[bridge-mls-cron] triggered incremental status=${syncRes.status}`, data);

    return new Response(
      JSON.stringify({ ok: syncRes.ok, mode: "incremental", ...data }),
      { status: syncRes.status, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[bridge-mls-cron] failed:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
