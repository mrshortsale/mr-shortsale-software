import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

function getServiceRoleKey(): string {
  return (Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async () => {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey || !serviceRoleKey.startsWith("eyJ")) {
    return json({ ok: false, error: "Missing service role key" }, 500);
  }

  const { data: sources, error } = await supabase
    .from("county_sources")
    .select("id, name")
    .eq("is_active", true)
    .eq("schedule", "daily");

  if (error) return json({ ok: false, error: "Failed to load county sources" }, 500);

  const results = [];
  const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/county-scraper-sync`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${serviceRoleKey}`,
    "apikey": serviceRoleKey,
  };

  for (const source of sources ?? []) {
    try {
      const response = await fetch(syncUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ county_source_id: source.id, _scheduledTrigger: true }),
      });
      const data = await response.json();
      console.log(`[county-scraper-cron] ${source.name} status=${response.status}`, data);
      results.push({ source: source.name, ok: response.ok, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[county-scraper-cron] ${source.name} failed`, message);
      results.push({ source: source.name, ok: false, error: message });
    }
  }

  return json({ ok: true, results });
});
