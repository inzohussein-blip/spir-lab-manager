import { NextResponse } from "next/server";
import { labDbProblem } from "@/lib/db/lab";

/** For the error page: is this device's lab database the reason (and which one)? */
export const dynamic = "force-dynamic";

export async function GET() {
  const p = await labDbProblem().catch(() => null);
  return NextResponse.json(p ? { problem: p.code, host: p.host } : { problem: null }, { headers: { "cache-control": "no-store" } });
}
