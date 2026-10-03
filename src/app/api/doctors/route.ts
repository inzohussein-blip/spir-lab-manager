import { NextResponse, type NextRequest } from "next/server";
import { doctorsOn, labScope, publish, revoke, fetchShare, MAX_BOX } from "@/lib/doctors/server";
import { attemptsBlocked, noteAttempt, licensingEnabled } from "@/lib/license/server";
import { ipOf } from "@/lib/license/owner";

/** «نافذة الأطباء» (lib/doctors/server): the lab's computer leaves and removes sealed copies; a
 *  doctor's window fetches one by the name its code makes. */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  try { return json({ ok: true, on: await doctorsOn() }); } catch { return json({ ok: false, error: "unreachable" }, 502); }
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BOX + 10_000) return json({ ok: false, error: "too_big" }, 413);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  try {
    // Stopping a code always works (also while the provider has the window off), so a stopped
    // code's copy never waits on the server to be shown again later.
    if (b.op !== "revoke" && !(await doctorsOn())) return json({ ok: false, error: "off" }, 403);
    if (b.op === "fetch") {
      // A wrong code is answered «not found»; many in a row from one address wait a while.
      const limit = licensingEnabled(); // the provider's site (a lab's own server is its own)
      const ip = ipOf(req.headers);
      if (limit && (await attemptsBlocked("doctor", ip, 30))) return json({ ok: false, error: "too_many" }, 429);
      const r = await fetchShare(b.tag);
      if (!r.ok && limit) await noteAttempt("doctor", ip);
      return json(r, r.ok ? 200 : 404);
    }
    if (b.op !== "publish" && b.op !== "revoke") return json({ ok: false, error: "bad_request" }, 400);
    const who = await labScope(b);
    if (!who.ok) return json({ ok: false, error: who.error }, who.status);
    const r = b.op === "publish" ? await publish(who.scope, b.tag, b.box) : await revoke(who.scope, b.tag);
    return json(r, r.ok ? 200 : 400);
  } catch {
    return json({ ok: false, error: "unreachable" }, 502);
  }
}
