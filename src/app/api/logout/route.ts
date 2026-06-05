import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { CONNECTION_COOKIE } from "@/lib/connection";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const expire = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
  // Clear the auth cookie and drop any saved S3 connections so the next
  // user doesn't inherit them.
  res.cookies.set(AUTH_COOKIE, "", expire);
  res.cookies.set(CONNECTION_COOKIE, "", expire);
  return res;
}
