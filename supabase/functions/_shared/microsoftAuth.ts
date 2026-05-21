import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "./crypto.ts";
export { generateState, verifyState, type OAuthCredentials } from "./googleAuth.ts";

export async function fetchMicrosoftCredentials(supabase: SupabaseClient): Promise<OAuthCredentials | null> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("slug", "microsoft-signin")
    .single();

  if (!integration) return null;

  const { data: cred } = await supabase
    .from("integration_credentials")
    .select("encrypted_credentials, credentials_iv, status")
    .eq("integration_id", integration.id)
    .single();

  // Only block when the CEO has explicitly disabled the integration.
  // "error" (from a failed test) must not lock users out of sign-in.
  if (!cred || cred.status === "disabled") return null;

  try {
    const decrypted = await decrypt(cred.encrypted_credentials, cred.credentials_iv);
    const parsed = JSON.parse(decrypted) as Record<string, string>;
    if (!parsed.clientId || !parsed.clientSecret) return null;
    return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
  } catch {
    return null;
  }
}

export interface MicrosoftProfile {
  sub: string;       // Azure object ID (the "id" field from /me)
  email: string;
  name: string;
  givenName: string;
  familyName: string;
}

export type MicrosoftProvisionResult =
  | { ok: true; user: { id: string; email: string; name: string; role: string } }
  | { ok: false; error: string };

export async function loginOrProvisionWithMicrosoft(
  profile: MicrosoftProfile,
  supabase: SupabaseClient,
): Promise<MicrosoftProvisionResult> {
  const email = profile.email.toLowerCase().trim();

  const { data: rows } = await supabase
    .from("users")
    .select("id, email, name, role, is_active, status, microsoft_id")
    .filter("email", "ilike", email)
    .limit(1);

  const existing = rows?.[0] ?? null;

  if (existing) {
    if (existing.status === "active" && existing.is_active) {
      const updates: Record<string, unknown> = { last_login_at: new Date().toISOString() };
      if (!existing.microsoft_id) updates.microsoft_id = profile.sub;
      await supabase.from("users").update(updates).eq("id", existing.id);
      return { ok: true, user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role } };
    }
    if (existing.status === "pending") {
      return { ok: false, error: "account_pending_approval" };
    }
    return { ok: false, error: "account_disabled" };
  }

  // New user — obey approval workflow
  const name = [profile.givenName, profile.familyName].filter(Boolean).join(" ") || email.split("@")[0];
  const { error: insertError } = await supabase.from("users").insert({
    email,
    name,
    password_hash: null,
    role: "rep",
    status: "pending",
    is_active: false,
    microsoft_id: profile.sub,
  });

  if (insertError) {
    console.error("[microsoft-auth] insert error:", insertError);
    return { ok: false, error: "microsoft_auth_failed" };
  }

  return { ok: false, error: "account_pending_approval" };
}
