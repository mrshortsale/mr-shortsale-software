import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { verifyJwt } from "../_shared/jwt.ts";
import {
  assignRepsRoundRobin,
  loadAssignableRepIds,
  loadRoundRobinIndex,
  saveRoundRobinIndex,
} from "../_shared/roundRobin.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")!,
);

const COUNTY_SCOPE = "county_scraper";
const EMPTY_CONTENT_ERROR =
  "Firecrawl returned no content. Page may require form interaction. Try switching to Apify.";

interface CountySourceRow {
  id: string;
  name: string;
  state: string;
  scrape_url: string;
}

interface ExtractedCountyRecord {
  homeowner_name?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  county?: unknown;
  filing_date?: unknown;
  case_number?: unknown;
  [key: string]: unknown;
}

function bearerToken(req: Request): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? null;
}

async function isCeoRequest(req: Request, body: Record<string, unknown>): Promise<boolean> {
  const serviceKey = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
  if (body._scheduledTrigger === true && serviceKey && bearerToken(req) === serviceKey) {
    return true;
  }

  const token = (req.headers.get("x-auth-token") || bearerToken(req) || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return false;

  try {
    const payload = await verifyJwt(token) as { sub: string; role: string };
    if (payload.role !== "ceo") return false;

    const { data } = await supabase
      .from("users")
      .select("id, role, is_active")
      .eq("id", payload.sub)
      .single();

    return !!data && data.role === "ceo" && data.is_active;
  } catch {
    return false;
  }
}

async function loadVaultSecret(name: string): Promise<string | null> {
  const { data } = await supabase
    .schema("vault")
    .from("decrypted_secrets")
    .select("decrypted_secret")
    .eq("name", name)
    .maybeSingle();

  const vaultValue = (data as { decrypted_secret?: string } | null)?.decrypted_secret;
  return (vaultValue ?? Deno.env.get(name) ?? "").trim() || null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function extractMarkdown(payload: Record<string, unknown>): string {
  const data = payload.data as Record<string, unknown> | undefined;
  return stringValue(data?.markdown ?? payload.markdown ?? data?.content ?? payload.content);
}

function parseExtractedRecords(content: string): ExtractedCountyRecord[] {
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed.filter((record) => record && typeof record === "object") : [];
}

function urgencyScore(filingDate: unknown): number {
  if (!filingDate) return 5;
  const date = new Date(String(filingDate));
  if (Number.isNaN(date.getTime())) return 5;

  const ageInDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageInDays <= 30) return 9;
  if (ageInDays <= 60) return 7;
  return 5;
}

async function updateRun(runId: string, updates: Record<string, unknown>) {
  const { data } = await supabase
    .from("county_scrape_runs")
    .update(updates)
    .eq("id", runId)
    .select("*, county_sources(name)")
    .single();
  return data;
}

async function scrapeCountyMarkdown(countySource: CountySourceRow): Promise<string> {
  const firecrawlKey = await loadVaultSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) throw new Error("Missing FIRECRAWL_API_KEY in Supabase vault");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: countySource.scrape_url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 2000,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return response.ok ? extractMarkdown(payload as Record<string, unknown>) : "";
}

async function extractCountyRecords(markdown: string): Promise<ExtractedCountyRecord[]> {
  const openaiKey = await loadVaultSecret("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in Supabase vault");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You are a real estate data extraction assistant for Florida foreclosure records.",
            "Extract all lis pendens and foreclosure filing records from the content below.",
            "Return ONLY a valid JSON array (no markdown, no explanation).",
            "Each item must include homeowner_name, address, city, state, zip, county,",
            "filing_type, filing_date, case_number, mortgage_lender, attorney_name, amount_owed, parcel_id.",
            "If no records found, return [].",
          ].join(" "),
        },
        { role: "user", content: markdown },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI extraction failed");
  return parseExtractedRecords(String(payload.choices?.[0]?.message?.content ?? "[]"));
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.county_source_id || typeof body.county_source_id !== "string") {
    return jsonResponse({ error: "county_source_id is required" }, 400);
  }
  if (!await isCeoRequest(req, body)) {
    return jsonResponse({ error: "Unauthorized — CEO access required" }, 403);
  }

  const { data: countySourceRow } = await supabase
    .from("county_sources")
    .select("id, name, state, scrape_url")
    .eq("id", body.county_source_id)
    .maybeSingle();

  if (!countySourceRow) return jsonResponse({ error: "County source not found" }, 404);
  const countySource = countySourceRow as CountySourceRow;

  const { data: run, error: runError } = await supabase
    .from("county_scrape_runs")
    .insert({ county_source_id: body.county_source_id, status: "running" })
    .select()
    .single();

  if (runError || !run) return jsonResponse({ error: "Failed to create scrape run" }, 500);

  try {
    const markdown = await scrapeCountyMarkdown(countySource);
    if (!markdown) {
      const failedRun = await updateRun(run.id, {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: EMPTY_CONTENT_ERROR,
      });
      return jsonResponse({ run: failedRun, records_inserted: 0, records_skipped: 0, sample_records: [] });
    }

    const rawPreview = markdown.slice(0, 500);
    const records = await extractCountyRecords(markdown);
    const repIds = await loadAssignableRepIds(supabase);
    let roundRobinIndex = await loadRoundRobinIndex(supabase, COUNTY_SCOPE);
    let recordsInserted = 0;
    let recordsSkipped = 0;
    const sampleRecords: Record<string, unknown>[] = [];

    for (const record of records) {
      const caseNumber = stringValue(record.case_number);
      const county = stringValue(record.county, countySource.name);
      if (!caseNumber) {
        recordsSkipped++;
        continue;
      }

      const { count } = await supabase
        .from("inventory_leads")
        .select("*", { count: "exact", head: true })
        .eq("county", county)
        .eq("external_id", caseNumber);

      if ((count ?? 0) > 0) {
        recordsSkipped++;
        continue;
      }

      const assignment = repIds.length
        ? assignRepsRoundRobin(repIds, roundRobinIndex, 1)
        : { assignments: [null], nextIndex: roundRobinIndex };
      roundRobinIndex = assignment.nextIndex;

      const score = urgencyScore(record.filing_date);
      const lead = {
        id: crypto.randomUUID(),
        source: "County",
        external_id: caseNumber,
        data_source: "County",
        data_source_primary: "CountyScraper",
        owner: stringValue(record.homeowner_name),
        address: stringValue(record.address),
        city: stringValue(record.city),
        state: stringValue(record.state, countySource.state || "FL"),
        county,
        score,
        filing_type: "LP",
        received_at: record.filing_date || new Date().toISOString(),
        assigned_rep_id: assignment.assignments[0],
        phone: null,
        email: null,
        raw_payload: record,
      };

      const { error } = await supabase.from("inventory_leads").insert(lead);
      if (error) {
        recordsSkipped++;
        continue;
      }

      recordsInserted++;
      if (sampleRecords.length < 3) {
        sampleRecords.push({
          homeowner_name: lead.owner,
          address: lead.address,
          filing_date: record.filing_date ?? null,
          urgency_score: score,
        });
      }
    }

    if (repIds.length) await saveRoundRobinIndex(supabase, roundRobinIndex, repIds.length, COUNTY_SCOPE);

    const completedRun = await updateRun(run.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      records_found: records.length,
      records_inserted: recordsInserted,
      records_skipped: recordsSkipped,
      raw_preview: rawPreview,
      sample_records: sampleRecords,
    });

    await supabase
      .from("county_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_record_count: recordsInserted })
      .eq("id", countySource.id);

    return jsonResponse({
      run: completedRun,
      records_inserted: recordsInserted,
      records_skipped: recordsSkipped,
      sample_records: sampleRecords,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown scrape error";
    const failedRun = await updateRun(run.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message,
    });

    return jsonResponse({ run: failedRun, records_inserted: 0, records_skipped: 0, sample_records: [] }, 500);
  }
});
