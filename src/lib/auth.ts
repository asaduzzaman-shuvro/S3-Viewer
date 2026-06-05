import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const AUTH_COOKIE = "s3v_auth";

// ---------------------------------------------------------------------------
// APP_SECRET underpins both the auth cookie and the AES encryption of saved S3
// credentials, so a missing/weak value is a real risk — fail loudly instead of
// silently falling back. Edge-safe: just an env read, no Node crypto.
// ---------------------------------------------------------------------------
export function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "APP_SECRET must be set to a strong random string (at least 16 characters). " +
        "It secures the auth cookie and encrypts saved S3 credentials. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  return secret;
}

// The cookie token is APP_SECRET — a long random string set in .env.local.
export function cookieValue(): string {
  return getAppSecret();
}

// ---------------------------------------------------------------------------
// Edge-safe auth check: plain string comparison.
// Used by middleware (Edge runtime).
// ---------------------------------------------------------------------------
export function isAuthedRequest(req: NextRequest): boolean {
  const cookie = req.cookies.get(AUTH_COOKIE);
  return cookie?.value === cookieValue();
}

// ---------------------------------------------------------------------------
// Server-component auth check (reads Next.js async cookie store).
// ---------------------------------------------------------------------------
export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value === cookieValue();
}
