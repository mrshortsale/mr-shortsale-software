import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName: string;
  familyName: string;
  picture: string;
}

export type ProvisionResult =
  | { ok: true; user: { id: string; email: string; name: string; role: string } }
  | { ok: false; error: string };

export async function loginOrProvisionWithGoogle(
  profile: GoogleProfile,
  supabase: SupabaseClient,
): Promise<ProvisionResult> {
  const email = profile.email.toLowerCase().trim();

  const { data: rows } = await supabase
    .from("users")
    .select("id, email, name, role, avatar_color, is_active, status, google_id")
    .filter("email", "ilike", email)
    .limit(1);

  const existing = rows?.[0] ?? null;

  if (existing) {
    if (existing.status === "active" && existing.is_active) {
      // Link google_id if not already set
      const updates: Record<string, unknown> = { last_login_at: new Date().toISOString() };
      if (!existing.google_id) updates.google_id = profile.sub;
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
    google_id: profile.sub,
  });

  if (insertError) {
    console.error("[google-auth] insert error:", insertError);
    return { ok: false, error: "google_auth_failed" };
  }

  return { ok: false, error: "account_pending_approval" };
}

// ─── HMAC state helpers ───────────────────────────────────────────────────────

const STATE_TTL_MS = 5 * 60 * 1000;

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  return expected === signature;
}

export async function generateState(secret: string): Promise<string> {
  const payload = `google:${Date.now()}`;
  const sig = await hmacSign(payload, secret);
  return btoa(JSON.stringify({ payload, sig }));
}

export async function verifyState(stateParam: string, secret: string): Promise<boolean> {
  try {
    const decoded = JSON.parse(atob(stateParam)) as { payload: string; sig: string };
    const valid = await hmacVerify(decoded.payload, decoded.sig, secret);
    if (!valid) return false;
    const timestamp = parseInt(decoded.payload.split(":")[1]);
    if (isNaN(timestamp) || Date.now() - timestamp > STATE_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}
