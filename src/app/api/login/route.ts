import { NextRequest, NextResponse } from "next/server";
import { cookieValue, AUTH_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth.server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, cookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // secure: true — enable this when deploying over HTTPS
  });
  return res;
}
