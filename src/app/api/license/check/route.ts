import { NextResponse, type NextRequest } from "next/server";
import { check, licensingEnabled } from "@/lib/license/server";
import { deviceReply } from "../device";

/** Periodic refresh from an activated device (extension, station changes, stop). */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });
  let lid = "", device = "";
  try { const b = await req.json(); lid = String(b?.lid ?? ""); device = String(b?.device ?? ""); } catch { /* empty */ }
  if (!lid || !device) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  return deviceReply(await check(lid, device));
}
