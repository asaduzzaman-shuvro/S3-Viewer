import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const AUTH_COOKIE = "s3v_auth";

// Mark cookies Secure (HTTPS-only) in production so the auth token and the encrypted-
// credential cookie are never sent over plain HTTP. Left off in development because the
// dev server runs on http://localhost — a Secure cookie would not be sent back over
// plain HTTP (Safari refuses it outright), which would bounce every post-login request
// back to /login. Production must be served over HTTPS for this to protect anything.
export const COOKIE_SECURE = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// APP_SECRET underpins both the auth cookie and the AES encryption of saved S3
// credentials, so it must be strong. Policy: longer than 24 characters, with at
// least 4 digits and at least 4 special (non-alphanumeric) characters. The app
// refuses to run otherwise. Edge-safe: pure string checks, no Node crypto.
//
// Note: random hex/base64 won't reliably contain special characters — use a long
// passphrase that mixes letters, digits, and symbols.
// ---------------------------------------------------------------------------
const MIN_LENGTH = 24; // must be GREATER than this (i.e. 25+)
const MIN_DIGITS = 4;
const MIN_SPECIALS = 4;

const POLICY = `APP_SECRET must be more than ${MIN_LENGTH} characters and contain at least ${MIN_DIGITS} digits and ${MIN_SPECIALS} special characters (e.g. a long passphrase like "Tr0ub4dour&3-Horse$Battery!Staple").`;

let validatedSecret: string | null = null;

export function getAppSecret(): string {
  if (validatedSecret) return validatedSecret;

  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error(`APP_SECRET must be set. ${POLICY}`);
  }

  const digits = (secret.match(/[0-9]/g) ?? []).length;
  const specials = (secret.match(/[^A-Za-z0-9]/g) ?? []).length;
  const unmet: string[] = [];
  if (secret.length <= MIN_LENGTH) unmet.push(`be longer than ${MIN_LENGTH} characters (got ${secret.length})`);
  if (digits < MIN_DIGITS) unmet.push(`have at least ${MIN_DIGITS} digits (got ${digits})`);
  if (specials < MIN_SPECIALS) unmet.push(`have at least ${MIN_SPECIALS} special characters (got ${specials})`);

  if (unmet.length > 0) {
    throw new Error(`APP_SECRET does not meet the security policy — it must ${unmet.join("; ")}. ${POLICY}`);
  }

  validatedSecret = secret; // memoize: validate once per process
  return secret;
}

// ---------------------------------------------------------------------------
// The auth cookie holds a ONE-WAY derivation of APP_SECRET, not the secret
// itself — so a leaked cookie never reveals APP_SECRET (which also encrypts the
// saved S3 credentials). Uses Web Crypto (`crypto.subtle`), available in both the
// Edge and Node runtimes, so the same check works in middleware and on the server.
// ---------------------------------------------------------------------------
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The value stored in the auth cookie: an opaque token derived from APP_SECRET. */
export async function authToken(): Promise<string> {
  return sha256Hex(`${getAppSecret()}:s3v-auth-v1`);
}

// Constant-time string equality (Edge-safe, no Node crypto). The token length is
// fixed and public, so an early length check leaks nothing; the loop never
// short-circuits on content, so it doesn't leak how many characters matched.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Edge-safe auth check (works in the Edge middleware and Node routes).
// ---------------------------------------------------------------------------
export async function isAuthedRequest(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  return !!cookie && timingSafeEqualStr(cookie, await authToken());
}

// ---------------------------------------------------------------------------
// Server-component auth check (reads Next.js async cookie store).
// ---------------------------------------------------------------------------
export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(AUTH_COOKIE)?.value;
  return !!value && timingSafeEqualStr(value, await authToken());
}
