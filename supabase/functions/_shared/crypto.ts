const ENCRYPTION_KEY_ENV = "INTEGRATION_ENCRYPTION_KEY";

function getKeyBytes(): Uint8Array {
  const raw = Deno.env.get(ENCRYPTION_KEY_ENV);
  if (!raw || raw.length < 32) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be set (min 32 chars)`);
  }
  return new TextEncoder().encode(raw.slice(0, 32));
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(getKeyBytes());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv.buffer),
  };
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await importKey(getKeyBytes());
  const ivBytes = fromBase64(iv);
  const cipherBytes = fromBase64(ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    cipherBytes,
  );

  return new TextDecoder().decode(decrypted);
}
