import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const AUTH_COOKIE = "s3v_auth";

// ---------------------------------------------------------------------------
// The cookie token is APP_SECRET — a long random string set in .env.local.
// Edge-safe: no Node.js crypto import at module level.
// ---------------------------------------------------------------------------
export function cookieValue(): string {
  return process.env.APP_SECRET ?? "fallback-secret";
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
