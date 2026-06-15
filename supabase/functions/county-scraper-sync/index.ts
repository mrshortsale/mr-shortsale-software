import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { assignRepsRoundRobin, loadActiveRepIds, loadRoundRobinIndex, saveRoundRobinIndex } from "../_shared/roundRobin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!);
const COUNTY_SCOPE = "county_scraper";

type ExtractedRecord = { homeowner_name: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; county: string | null; filing_type: string | null; filing_date: string | null; case_number: string | null; mortgage_lender: string | null; attorney_name: string | null; amount_owed: number | null; parcel_id: string | null };

async function requireCeo(req: Request): Promise<boolean> {
  const token = (req.headers.get("x-auth-token") || req.headers.get("authorization"))?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return false;
    const { data } = await supabase.from("users").select("id, role, is_active").eq("id", payload.sub).single();
    return !!data && data.role === "ceo" && data.is_active;
  } catch { return false; }
}

function isScheduled(req: Request, body: Record<string, unknown>): boolean {
  return body._scheduledTrigger === true && req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() === Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
}

async function scrapeFirecrawl(url: string): Promise<string> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("Missing FIRECRAWL_API_KEY");
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: true, waitFor: 2000, actions: [{ type: "wait", milliseconds: 1500 }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Firecrawl scrape failed");
  return [data.data?.markdown, data.data?.html, data.markdown, data.html].filter(Boolean).join("\n\n");
}

async function scrapeApify(source: Record<string, unknown>, dateFrom?: string): Promise<string> {
  const apiKey = Deno.env.get("APIFY_API_KEY");
  const actorId = String(source.apify_actor_id ?? "");
  if (!apiKey) throw new Error("Missing APIFY_API_KEY");
  if (!actorId) throw new Error("Apify actor ID is required for this county source");
  const res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: source.scrape_url, dateFrom }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message ?? "Apify run failed");
  return JSON.stringify(data).slice(0, 20000);
}

async function extractRecords(raw: string): Promise<ExtractedRecord[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const system = `You are a real estate data extraction assistant. Extract lis pendens and foreclosure filing records from the following county clerk website content. Return a JSON array of records. Each record must have: { homeowner_name: string, address: string, city: string, state: string (default 'FL'), zip: string, county: string, filing_type: 'Lis Pendens', filing_date: string (YYYY-MM-DD), case_number: string, mortgage_lender: string, attorney_name: string, amount_owed: number | null, parcel_id: string | null }. If a field is not found, use null. Return ONLY the JSON array, no other text.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: raw.slice(0, 60000) }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message ?? "OpenAI extraction failed");
  const text = data.choices?.[0]?.message?.content ?? "[]";
  return JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, ""));
}

function urgencyFromFilingDate(filingDate: string | null): number {
  if (!filingDate) return 5;
  const age = Math.max(0, Math.floor((Date.now() - new Date(filingDate).getTime()) / 86400000));
  if (age < 30) return 10;
  if (age < 60) return 8;
  if (age < 90) return 6;
  return 5;
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  const body = await req.json().catch(() => ({}));
  if (!isScheduled(req, body) && !(await requireCeo(req))) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const sourceId = body.county_source_id;
  if (!sourceId) return jsonResponse({ error: "county_source_id is required" }, 400);

  const { data: source, error: sourceErr } = await supabase.from("county_sources").select("*").eq("id", sourceId).single();
  if (sourceErr || !source) return jsonResponse({ error: "County source not found" }, 404);
  const { data: run, error: runErr } = await supabase.from("county_scrape_runs").insert({ county_source_id: sourceId, status: "running" }).select("*").single();
  if (runErr || !run) return jsonResponse({ error: "Failed to start scrape run" }, 500);

  try {
    let raw = source.scrape_method === "apify" ? await scrapeApify(source, body.date_from) : await scrapeFirecrawl(String(source.scrape_url));
    if (raw.trim().length < 200 && source.scrape_method === "apify") raw = await scrapeApify(source, body.date_from);
    if (raw.trim().length < 200 || /<form|Search.aspx|document type/i.test(raw.slice(0, 4000))) {
      throw new Error("Page requires form interaction — switch to Apify method");
    }
    const records = await extractRecords(raw);
    const repIds = await loadActiveRepIds(supabase);
    let rrIndex = repIds.length ? await loadRoundRobinIndex(supabase, COUNTY_SCOPE) : 0;
    let inserted = 0;
    let skipped = 0;
    for (const rec of records) {
      const caseNumber = rec.case_number?.trim();
      if (!caseNumber) { skipped++; continue; }
      const county = rec.county || source.name;
      const { data: existing } = await supabase.from("inventory_leads").select("id").eq("source", "CountyScraper").eq("external_id", `${county}:${caseNumber}`).maybeSingle();
      if (existing) { skipped++; continue; }
      let assignedRepId: string | null = null;
      if (repIds.length) { const rr = assignRepsRoundRobin(repIds, rrIndex, 1); assignedRepId = rr.assignments[0]; rrIndex = rr.nextIndex; }
      const row = {
        id: crypto.randomUUID(), source: "CountyScraper", external_id: `${county}:${caseNumber}`,
        owner: rec.homeowner_name ?? "", address: rec.address ?? "", city: rec.city ?? "", state: rec.state ?? source.state ?? "FL", county,
        equity_pct: 0, days_to_auction: 999, score: urgencyFromFilingDate(rec.filing_date), phone: null, email: null,
        filing_type: "LP", apn: rec.parcel_id, assigned_rep_id: assignedRepId, status: "New",
        raw_payload: { ...rec, data_source_primary: "CountyScraper", call_status: "Not Called", filing_type_label: "Lis Pendens", mortgage_balance: rec.amount_owed },
      };
      const { error } = await supabase.from("inventory_leads").insert(row);
      if (error) { skipped++; console.error(error.message); } else inserted++;
    }
    if (repIds.length) await saveRoundRobinIndex(supabase, rrIndex, repIds.length, COUNTY_SCOPE);
    await supabase.from("county_scrape_runs").update({ status: "completed", completed_at: new Date().toISOString(), records_found: records.length, records_inserted: inserted, records_skipped: skipped, raw_preview: raw.slice(0, 500) }).eq("id", run.id);
    await supabase.from("county_sources").update({ last_scraped_at: new Date().toISOString(), last_record_count: inserted, updated_at: new Date().toISOString() }).eq("id", sourceId);
    return jsonResponse({ ok: true, runId: run.id, records_found: records.length, records_inserted: inserted, records_skipped: skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("county_scrape_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", run.id);
    return jsonResponse({ ok: false, runId: run.id, error: message }, 500);
  }
});
