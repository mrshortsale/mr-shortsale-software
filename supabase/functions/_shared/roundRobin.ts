import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SCOPE = "batch_inventory";

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

/**
 * Read the persisted round-robin cursor. Returns 0 when no row exists yet.
 */
export async function loadRoundRobinIndex(
  supabase: SupabaseClient,
): Promise<number> {
  const { data } = await supabase
    .from("inventory_round_robin_state")
    .select("next_index")
    .eq("scope", SCOPE)
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
): Promise<void> {
  const stored = repCount > 0 ? index % repCount : 0;
  await supabase
    .from("inventory_round_robin_state")
    .upsert(
      { scope: SCOPE, next_index: stored, updated_at: new Date().toISOString() },
      { onConflict: "scope" },
    );
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
