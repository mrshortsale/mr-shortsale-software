function getServiceRoleKey(): string {
  return (Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

Deno.serve(async () => {
  const key = getServiceRoleKey();
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
  if (!key || !key.startsWith("eyJ")) return new Response(JSON.stringify({ ok: false, error: "Missing service role key" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "apikey": key };
  try {
    const listRes = await fetch(`${base}/county-sources-manage`, { headers });
    const list = await listRes.json();
    if (!listRes.ok) throw new Error(list.error ?? "Failed to list county sources");
    const date = todayEastern();
    const results = [];
    for (const source of (list.countySources ?? []).filter((s: any) => s.is_active && s.schedule === "daily")) {
      try {
        const res = await fetch(`${base}/county-scraper-sync`, { method: "POST", headers, body: JSON.stringify({ county_source_id: source.id, date_from: date, date_to: date, _scheduledTrigger: true }) });
        results.push({ county_source_id: source.id, status: res.status, ...(await res.json()) });
      } catch (err) { results.push({ county_source_id: source.id, ok: false, error: err instanceof Error ? err.message : "Unknown error" }); }
    }
    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
