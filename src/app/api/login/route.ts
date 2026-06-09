import { NextRequest, NextResponse } from "next/server";
import { authToken, AUTH_COOKIE, COOKIE_SECURE } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth.server";
import { checkLoginRate, recordLoginFailure, recordLoginSuccess } from "@/lib/rate-limit";

// Best-effort client identifier for throttling, from proxy-set forwarding headers.
// Returns null when the client can't be identified — the limiter then never
// hard-locks it, so a request with no/forged identity can't deny logins for others.
// NOTE: these headers are only trustworthy behind a proxy that sets them; without
// one they're client-controlled, so per-client limits are best-effort.
function clientId(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return ip || null;
}

export async function POST(req: NextRequest) {
  const id = clientId(req);
  const rate = checkLoginRate(id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  // Global friction delay under a failure spike (never denies a correct login).
  if (rate.delayMs > 0) await new Promise((r) => setTimeout(r, rate.delayMs));

  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  if (!password || !verifyPassword(password)) {
    recordLoginFailure(id);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  recordLoginSuccess(id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: COOKIE_SECURE,
  });
  return res;
}
