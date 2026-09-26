import { NextResponse, type NextRequest } from "next/server";
import { activate, licensingEnabled, normalizeCode } from "@/lib/license/server";
import { tooManyTries, noteFail, clearFails, ipOf } from "@/lib/license/owner";
import { deviceReply } from "../device";

/** A lab enters its code on a device (first use binds the device and starts the period). */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });
  const ip = ipOf(req.headers);
  if (tooManyTries(ip)) return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });
  let code = "", device = "", label = "";
  try {
    const b = await req.json();
    code = String(b?.code ?? ""); device = String(b?.device ?? ""); label = String(b?.label ?? "");
  } catch { /* empty */ }
  if (normalizeCode(code).length < 8 || !/^[\w-]{8,80}$/.test(device)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const r = await activate(code, device, label);
  if (!r.ok && r.error === "not_found") {
    noteFail(ip);
    await new Promise((res) => setTimeout(res, 400)); // slow down guessing
  } else clearFails(ip);
  return deviceReply(r);
}
