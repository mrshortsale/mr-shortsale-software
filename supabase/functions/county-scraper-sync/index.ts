import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJwt } from "../_shared/jwt.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { assignRepsRoundRobin, loadActiveRepIds, loadRoundRobinIndex, saveRoundRobinIndex } from "../_shared/roundRobin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!);
const COUNTY_SCOPE = "county_scraper";
const EMPTY_CONTENT_ERROR = "Firecrawl returned no content. Page may require form interaction. Try switching to Apify.";

async function requireCeo(req: Request, body?: Record<string, unknown>): Promise<boolean> {
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (body?._scheduledTrigger === true && serviceKey && bearer === serviceKey) return true;
  const token = (req.headers.get("x-auth-token") || bearer || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return false;
    const { data } = await supabase.from("users").select("id, role, is_active").eq("id", payload.sub).single();
    return !!data && data.role === "ceo" && data.is_active;
  } catch { return false; }
}

async function loadSecret(name: string): Promise<string | null> {
  const { data } = await supabase.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("name", name).maybeSingle();
  return ((data as { decrypted_secret?: string } | null)?.decrypted_secret ?? Deno.env.get(name) ?? null)?.trim() || null;
}

function extractMarkdown(payload: Record<string, unknown>): string {
  const data = payload.data as Record<string, unknown> | undefined;
  return String(data?.markdown ?? payload.markdown ?? data?.content ?? payload.content ?? "").trim();
}

function parseRecords(content: string): Array<Record<string, unknown>> {
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r === "object") : [];
}

function urgencyScore(filingDate: unknown): number {
  if (!filingDate) return 5;
  const date = new Date(String(filingDate));
  if (Number.isNaN(date.getTime())) return 5;
  const days = (Date.now() - date.getTime()) / 86400000;
  if (days <= 30) return 9;
  if (days <= 60) return 7;
  return 5;
}

async function finishRun(runId: string, updates: Record<string, unknown>) {
  const { data } = await supabase.from("county_scrape_runs").update(updates).eq("id", runId).select("*, county_sources(name)").single();
  return data;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.county_source_id) return jsonResponse({ error: "county_source_id is required" }, 400);
  if (!await requireCeo(req, body)) return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);

  const { data: countySource } = await supabase.from("county_sources").select("*").eq("id", body.county_source_id).maybeSingle();
  if (!countySource) return jsonResponse({ error: "County source not found" }, 404);

  const { data: run, error: runErr } = await supabase.from("county_scrape_runs").insert({ county_source_id: body.county_source_id, status: "running" }).select().single();
  if (runErr || !run) return jsonResponse({ error: "Failed to create scrape run" }, 500);

  try {
    const firecrawlKey = await loadSecret("FIRECRAWL_API_KEY");
    if (!firecrawlKey) throw new Error("Missing FIRECRAWL_API_KEY in Supabase vault");
    const fireRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: countySource.scrape_url, formats: ["markdown"], onlyMainContent: true, waitFor: 2000 }),
    });
    const fireData = await fireRes.json().catch(() => ({}));
    const markdown = fireRes.ok ? extractMarkdown(fireData as Record<string, unknown>) : "";
    if (!markdown) {
      const failed = await finishRun(run.id, { status: "failed", completed_at: new Date().toISOString(), error_message: EMPTY_CONTENT_ERROR });
      return jsonResponse({ run: failed, records_inserted: 0, records_skipped: 0, sample_records: [] });
    }

    const rawPreview = markdown.slice(0, 500);
    const openaiKey = await loadSecret("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in Supabase vault");
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: "You are a real estate data extraction assistant for Florida foreclosure records. Extract all lis pendens and foreclosure filing records from the content below. Return ONLY a valid JSON array (no markdown, no explanation). Each item: { homeowner_name: string, address: string, city: string, state: string, zip: string, county: string, filing_type: string, filing_date: string (YYYY-MM-DD or null), case_number: string, mortgage_lender: string | null, attorney_name: string | null, amount_owed: number | null, parcel_id: string | null }. If no records found, return []." },
          { role: "user", content: markdown },
        ],
      }),
    });
    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message ?? "OpenAI extraction failed");
    const records = parseRecords(String(aiData.choices?.[0]?.message?.content ?? "[]"));

    const repIds = await loadActiveRepIds(supabase);
    let rrIndex = await loadRoundRobinIndex(supabase, COUNTY_SCOPE);
    let inserted = 0;
    let skipped = 0;
    const samples: Record<string, unknown>[] = [];

    for (const record of records) {
      const caseNumber = String(record.case_number ?? "").trim();
      const county = String(record.county ?? countySource.name ?? "").trim();
      if (!caseNumber) { skipped++; continue; }
      const { count } = await supabase.from("inventory_leads").select("*", { count: "exact", head: true }).eq("county", county).eq("external_id", caseNumber);
      if ((count ?? 0) > 0) { skipped++; continue; }
      const { assignments, nextIndex } = repIds.length ? assignRepsRoundRobin(repIds, rrIndex, 1) : { assignments: [null], nextIndex: rrIndex };
      rrIndex = nextIndex;
      const score = urgencyScore(record.filing_date);
      const lead = {
        id: crypto.randomUUID(),
        source: "County",
        external_id: caseNumber,
        data_source: "County",
        data_source_primary: "CountyScraper",
        owner: String(record.homeowner_name ?? ""),
        address: String(record.address ?? ""),
        city: String(record.city ?? ""),
        state: String(record.state ?? countySource.state ?? "FL"),
        county,
        score,
        filing_type: "LP",
        received_at: record.filing_date || new Date().toISOString(),
        assigned_rep_id: assignments[0],
        phone: null,
        email: null,
        raw_payload: record,
      };
      const { error } = await supabase.from("inventory_leads").insert(lead);
      if (error) { skipped++; continue; }
      inserted++;
      if (samples.length < 3) samples.push({ homeowner_name: lead.owner, address: lead.address, filing_date: record.filing_date ?? null, urgency_score: score });
    }
    if (repIds.length) await saveRoundRobinIndex(supabase, rrIndex, repIds.length, COUNTY_SCOPE);

    const completed = await finishRun(run.id, { status: "completed", completed_at: new Date().toISOString(), records_found: records.length, records_inserted: inserted, records_skipped: skipped, raw_preview: rawPreview, sample_records: samples });
    await supabase.from("county_sources").update({ last_scraped_at: new Date().toISOString(), last_record_count: inserted }).eq("id", countySource.id);
    return jsonResponse({ run: completed, records_inserted: inserted, records_skipped: skipped, sample_records: samples });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown scrape error";
    const failed = await finishRun(run.id, { status: "failed", completed_at: new Date().toISOString(), error_message: message });
    return jsonResponse({ run: failed, records_inserted: 0, records_skipped: 0, sample_records: [] }, 500);
  }
});
