import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!);
function serviceKey(): string { return (Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? "").trim(); }

Deno.serve(async () => {
  const key = serviceKey();
  if (!key || !key.startsWith("eyJ")) return new Response(JSON.stringify({ ok: false, error: "Missing service role key" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const { data: sources, error } = await supabase.from("county_sources").select("id, name").eq("is_active", true).eq("schedule", "daily");
  if (error) return new Response(JSON.stringify({ ok: false, error: "Failed to load county sources" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const results = [];
  for (const source of sources ?? []) {
    try {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/county-scraper-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "apikey": key },
        body: JSON.stringify({ county_source_id: source.id, _scheduledTrigger: true }),
      });
      const data = await res.json();
      console.log(`[county-scraper-cron] ${source.name} status=${res.status}`, data);
      results.push({ source: source.name, ok: res.ok, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[county-scraper-cron] ${source.name} failed`, message);
      results.push({ source: source.name, ok: false, error: message });
    }
  }
  return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
});
