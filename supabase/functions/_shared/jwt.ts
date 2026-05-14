import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";

async function getKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp?: number;
  iat?: number;
}

export async function signJwt(payload: Omit<JwtPayload, "exp" | "iat">, expiresInDays = 7): Promise<string> {
  const key = await getKey();
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      ...payload,
      iat: getNumericDate(0),
      exp: getNumericDate(expiresInDays * 24 * 60 * 60),
    },
    key,
  );
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const key = await getKey();
  const payload = await verify(token, key) as JwtPayload;
  return payload;
}
