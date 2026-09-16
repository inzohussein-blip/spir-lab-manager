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

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
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
  // Run on everything except Next internals, API routes, and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
