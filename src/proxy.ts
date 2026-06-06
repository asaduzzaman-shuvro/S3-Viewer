import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Next.js internals and the login POST endpoint always pass through.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/login")
  ) {
    return NextResponse.next();
  }

  const authed = await isAuthedRequest(req);

  // The login page is public, but an already-authenticated visitor (e.g. via the
  // browser Back button) should be sent on to the app instead of seeing the form.
  if (pathname.startsWith("/login")) {
    if (authed) return redirectTo(req, "/browse");
    // Never cache the login page: otherwise the browser restores it from its
    // back/forward cache on a Back navigation without re-requesting, so the
    // authenticated→/browse redirect above wouldn't get a chance to run.
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  }

  // Everything else requires auth.
  return authed ? NextResponse.next() : redirectTo(req, "/login");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
