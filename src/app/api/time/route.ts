import { NextResponse } from "next/server";

/** The server's clock: the stations correct their own with it, so «the later change wins»
 *  compares real times even on a computer whose clock is wrong. */
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
