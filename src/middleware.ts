import { NextResponse, type NextRequest } from "next/server";

/**
 * Sets x-pathname (so the server layout can detect the current route) and does
 * a lightweight auth gate: unauthenticated visitors are redirected to /login.
 * This only checks cookie presence — the signature is verified server-side.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("lab_session");
  const isLogin = pathname === "/login";
  // Public routes that need no login: the version chooser (portal), QR report
  // verification, the offline Lab Station, the standalone Purchasing app and
  // the standalone Training station — all browser-storage only, no database.
  const isPublic =
    pathname === "/welcome" ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/station") ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/training");

  if (isPublic) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
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
