import { NextResponse } from "next/server";
import { AUTH_COOKIE, COOKIE_SECURE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Clear only the auth cookie. The saved-connection store (s3v_conn) is left intact
  // so customizations — added buckets and a renamed/overridden default — persist across
  // logins. This is a single-shared-password tool, so "the next user" is the same user;
  // the store stays encrypted + httpOnly in the meantime. (Use the switcher's remove/reset
  // controls to clear connections explicitly.)
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: COOKIE_SECURE,
    maxAge: 0,
  });
  return res;
}
