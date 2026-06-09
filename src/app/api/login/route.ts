import { NextRequest, NextResponse } from "next/server";
import { authToken, AUTH_COOKIE, COOKIE_SECURE } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth.server";
import { checkLoginRate, recordLoginFailure, recordLoginSuccess } from "@/lib/rate-limit";

// Best-effort client identifier for throttling. Trusts the proxy-set forwarding
// headers; falls back to a shared bucket when absent (still bounds total attempts).
function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  const rate = checkLoginRate(key);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  if (!password || !verifyPassword(password)) {
    recordLoginFailure(key);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  recordLoginSuccess(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: COOKIE_SECURE,
  });
  return res;
}
