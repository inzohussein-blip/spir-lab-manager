import { NextResponse, type NextRequest } from "next/server";
import { adminCookieValid } from "@/lib/license/adminCookie";
import { ADMIN_LICENSE_COOKIE } from "@/lib/license/modules";
import { licensingEnabled } from "@/lib/license/env";

/**
 * Sets x-pathname (so the server layout can detect the current route) and does
 * a lightweight auth gate: unauthenticated visitors are redirected to /login.
 * This only checks cookie presence — the signature is verified server-side.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("lab_session");
  const isLogin = pathname === "/login";
  // Public routes that need no login: the version chooser (portal), QR report
  // verification, the offline Lab Station, the standalone Purchasing app and
  // the standalone Training station — all browser-storage only, no database.
  // Whole path segments only, so e.g. "/stations-x" or "/storeroom" stay protected.
  const under = (base: string) => pathname === base || pathname.startsWith(base + "/");
  // /licenses is the owner's code manager (its own password, no lab login).
  const isPublic = ["/welcome", "/verify", "/station", "/store", "/training", "/qc", "/roster", "/licenses"].some(under);

  if (isPublic) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  // Lab codes switched on: the full admin panel (login included) opens only on a device whose
  // lab code includes it — the cookie comes with the device license (see /api/license).
  if (licensingEnabled() && !(await adminCookieValid(req.cookies.get(ADMIN_LICENSE_COOKIE)?.value))) {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!hasSession && !isLogin) {
    // Unauthenticated visitors land on the version chooser, not the login form.
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  // Run on everything except Next internals, API routes, and static files
  // (anything with a file extension, e.g. /lab-logo.png, /sw.js) — those must
  // be served without an auth redirect so public pages can load their assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.[\\w]+$).*)"],
};
