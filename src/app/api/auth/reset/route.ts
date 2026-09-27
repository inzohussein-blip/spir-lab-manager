import { NextResponse, type NextRequest } from "next/server";

/** Ends a sign-in that is no longer valid here (e.g. the lab's database changed) and opens the login. */
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.delete("lab_session");
  return res;
}
