import { NextResponse, type NextRequest } from "next/server";
import { licensingEnabled, reportSyncStatus } from "@/lib/license/server";

/** A device tells how its sync with the lab's database is going (shown on its code in /licenses). */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 400 });
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const lid = String(b.lid ?? ""), device = String(b.device ?? "");
  if (!lid || !/^[\w-]{8,80}$/.test(device)) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const ok = await reportSyncStatus(lid, device, {
    last: Number(b.last) > 0 ? Math.min(Number(b.last), Date.now() + 86_400_000) : null,
    pending: Math.max(0, Math.min(1e7, Math.round(Number(b.pending) || 0))),
    error: /^[a-z_]{0,20}$/.test(String(b.error ?? "")) ? String(b.error ?? "") : "db",
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 403, headers: { "cache-control": "no-store" } });
}
