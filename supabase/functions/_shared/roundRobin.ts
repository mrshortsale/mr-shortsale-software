import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const BATCH_INVENTORY_SCOPE = "batch_inventory";
export const REALTOR_MLS_SCOPE = "realtor_mls";
export const ZILLOW_APIFY_SCOPE = "zillow_apify";
export const GOOGLE_SHEETS_SCOPE = "google_sheets";

/**
 * Return UUIDs of all active sales reps ordered by name.
 * Matches the same filter used by admin-leads GET ?action=reps.
 */
export async function loadActiveRepIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("role", "rep")
    .eq("is_active", true)
    .or("status.eq.active,status.is.null")
    .order("name");

  if (error || !data) return [];
  return (data as Array<{ id: string }>).map((r) => r.id);
}

/** True when a lead has no rep or is assigned to a deleted/inactive rep name. */
export function needsRealtorAssignment(
  assignedRep: string | null | undefined,
  activeRepNames: string[],
): boolean {
  if (!assignedRep) return true;
  if (activeRepNames.length === 0) return true;
  return !activeRepNames.includes(assignedRep);
}

/** PostgREST .or() filter: assigned_rep IS NULL or not an active rep name. */
export function unassignedRealtorLeadsFilter(activeRepNames: string[]): string {
  if (activeRepNames.length === 0) {
    return "assigned_rep.is.null";
  }
  const quoted = activeRepNames
    .map((n) => `"${n.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `assigned_rep.is.null,assigned_rep.not.in.(${quoted})`;
}

/** Display names of active sales reps (used for mls_agent_leads.assigned_rep TEXT). */
export async function loadActiveRepNames(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("role", "rep")
    .eq("is_active", true)
    .or("status.eq.active,status.is.null")
    .order("name");

  if (error || !data) return [];
  return (data as Array<{ name: string }>).map((r) => r.name).filter(Boolean);
}

/**
 * Read the persisted round-robin cursor. Returns 0 when no row exists yet.
 */
export async function loadRoundRobinIndex(
  supabase: SupabaseClient,
  scope = BATCH_INVENTORY_SCOPE,
): Promise<number> {
  const { data } = await supabase
    .from("inventory_round_robin_state")
    .select("next_index")
    .eq("scope", scope)
    .maybeSingle();

  return (data as { next_index: number } | null)?.next_index ?? 0;
}

/**
 * Persist the updated cursor after a sync chunk finishes.
 * Modulo is applied here so the stored value stays within the rep list bounds.
 */
export async function saveRoundRobinIndex(
  supabase: SupabaseClient,
  index: number,
  repCount: number,
  scope = BATCH_INVENTORY_SCOPE,
): Promise<void> {
  const stored = repCount > 0 ? index % repCount : 0;
  await supabase
    .from("inventory_round_robin_state")
    .upsert(
      { scope, next_index: stored, updated_at: new Date().toISOString() },
      { onConflict: "scope" },
    );
}

/**
 * Assign every unassigned mls_agent_leads row to active reps in round-robin order.
 */
export async function assignUnassignedRealtorLeadsRoundRobin(
  supabase: SupabaseClient,
): Promise<{ assigned: number; repCount: number; error: string | null }> {
  const repNames = await loadActiveRepNames(supabase);
  if (repNames.length === 0) {
    return { assigned: 0, repCount: 0, error: "No active sales reps found" };
  }

  const { data: leads, error: listErr } = await supabase
    .from("mls_agent_leads")
    .select("id, assigned_rep")
    .order("created_at", { ascending: true });

  if (listErr) {
    return { assigned: 0, repCount: repNames.length, error: "Failed to load unassigned leads" };
  }

  const toAssign = (leads ?? []).filter((lead) =>
    needsRealtorAssignment(
      (lead as { assigned_rep: string | null }).assigned_rep,
      repNames,
    )
  );

  let rrIndex = await loadRoundRobinIndex(supabase, REALTOR_MLS_SCOPE);
  let assigned = 0;

  for (const lead of toAssign) {
    const { assignments, nextIndex } = assignRepsRoundRobin(repNames, rrIndex, 1);
    const { error: updateErr } = await supabase
      .from("mls_agent_leads")
      .update({ assigned_rep: assignments[0] })
      .eq("id", lead.id);
    if (!updateErr) {
      assigned++;
      rrIndex = nextIndex;
    }
  }

  await saveRoundRobinIndex(supabase, rrIndex, repNames.length, REALTOR_MLS_SCOPE);
  return { assigned, repCount: repNames.length, error: null };
}

/**
 * Assign every unassigned (or orphaned) zillow_agent_leads row to active reps
 * in round-robin order. Mirrors assignUnassignedRealtorLeadsRoundRobin().
 */
export async function assignUnassignedZillowLeadsRoundRobin(
  supabase: SupabaseClient,
): Promise<{ assigned: number; repCount: number; error: string | null }> {
  const repNames = await loadActiveRepNames(supabase);
  if (repNames.length === 0) {
    return { assigned: 0, repCount: 0, error: "No active sales reps found" };
  }

  const { data: leads, error: listErr } = await supabase
    .from("zillow_agent_leads")
    .select("id, assigned_rep")
    .order("created_at", { ascending: true });

  if (listErr) {
    return { assigned: 0, repCount: repNames.length, error: "Failed to load Zillow leads" };
  }

  const toAssign = (leads ?? []).filter((lead) =>
    needsRealtorAssignment(
      (lead as { assigned_rep: string | null }).assigned_rep,
      repNames,
    )
  );

  let rrIndex = await loadRoundRobinIndex(supabase, ZILLOW_APIFY_SCOPE);
  let assigned = 0;

  for (const lead of toAssign) {
    const { assignments, nextIndex } = assignRepsRoundRobin(repNames, rrIndex, 1);
    const { error: updateErr } = await supabase
      .from("zillow_agent_leads")
      .update({ assigned_rep: assignments[0] })
      .eq("id", lead.id);
    if (!updateErr) {
      assigned++;
      rrIndex = nextIndex;
    }
  }

  await saveRoundRobinIndex(supabase, rrIndex, repNames.length, ZILLOW_APIFY_SCOPE);
  return { assigned, repCount: repNames.length, error: null };
}

/**
 * Given the current cursor and a list of items that need assignment, return
 * one rep ID per item in round-robin order, plus the updated cursor.
 *
 * @param repIds   Ordered list of active rep UUIDs (must be non-empty).
 * @param startIndex  Current value of the global cursor.
 * @param count    Number of assignments to produce.
 */
export function assignRepsRoundRobin(
  repIds: string[],
  startIndex: number,
  count: number,
): { assignments: string[]; nextIndex: number } {
  const len = repIds.length;
  const assignments: string[] = [];
  for (let i = 0; i < count; i++) {
    assignments.push(repIds[(startIndex + i) % len]);
  }
  return { assignments, nextIndex: startIndex + count };
}
