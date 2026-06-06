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
// credentials, so a missing/weak value is a real risk — fail loudly instead of
// silently falling back. Edge-safe: just an env read, no Node crypto.
// ---------------------------------------------------------------------------
let warnedWeakSecret = false;

export function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error(
      "APP_SECRET must be set. It secures the auth cookie and encrypts saved S3 " +
        "credentials. Generate one with: openssl rand -hex 32"
    );
  }
  if (secret.length < 16 && !warnedWeakSecret) {
    warnedWeakSecret = true;
    console.warn(
      "[auth] APP_SECRET is short (<16 chars). It secures the auth cookie and " +
        "encrypts saved S3 credentials — consider a stronger value: openssl rand -hex 32"
    );
  }
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

// ---------------------------------------------------------------------------
// Edge-safe auth check (works in the Edge middleware and Node routes).
// ---------------------------------------------------------------------------
export async function isAuthedRequest(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  return !!cookie && cookie === (await authToken());
}

// ---------------------------------------------------------------------------
// Server-component auth check (reads Next.js async cookie store).
// ---------------------------------------------------------------------------
export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(AUTH_COOKIE)?.value;
  return !!value && value === (await authToken());
}
