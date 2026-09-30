import { NextResponse, type NextRequest } from "next/server";
import { licensingEnabled, deviceFromToken } from "@/lib/license/server";
import { companyPlace, hubPlace } from "@/lib/sync/company";
import { hubKeyMatches, hubOn } from "@/lib/sync/hub";
import { LabDbError, lastRevOn, probeOn, pullOn, pushOn, toLabError } from "@/lib/sync/pg";
import type { SyncRow } from "@/lib/sync/protocol";

/**
 * «المزامنة التلقائية»: a lab's computers exchange the station records they changed, through
 * the lab's own place (its database, or its own section of the site's). Served only to a
 * device presenting its signed license, bound to it, running and in date; the lab is the one
 * that license names.
 */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

/** Whether this server is the lab's local network hub (for «محطة المزامنة»). */
export async function GET() {
  return json({ hub: hubOn() });
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  // The lab's own local server («خادم الشبكة المحلية»): its key, no lab codes there.
  const viaHub = b.hub !== undefined;
  if (viaHub ? !hubOn() : !licensingEnabled()) return json({ ok: false, error: "disabled" }, 400);
  let lid = "";
  if (viaHub) {
    if (!hubKeyMatches(b.hub)) return json({ ok: false, error: "bad_hub_key" }, 403);
  } else {
    const who = await deviceFromToken(b.token, b.device);
    if (!who.ok) return json({ ok: false, error: who.error }, 403);
    lid = who.lid;
  }
  const node = String(b.node ?? "").slice(0, 80);
  try {
    const { q, place } = viaHub ? await hubPlace() : await companyPlace(lid);
    if (b.op === "probe") return json({ ok: true, ...(await probeOn(q)), rev: await lastRevOn(q), place });
    if (b.op === "pull") return json({ ok: true, rows: await pullOn(q, Number(b.since) || 0, node, Number(b.limit) || undefined), place });
    if (b.op === "push") {
      if (!node || !Array.isArray(b.rows)) return json({ ok: false, error: "bad_request" }, 400);
      return json({ ok: true, written: await pushOn(q, b.rows as SyncRow[], node), place });
    }
  } catch (e) {
    const err = e instanceof LabDbError ? e : toLabError(e);
    return json({ ok: false, error: err.code }, err.code === "needs_db" ? 409 : 502);
  }
  return json({ ok: false, error: "bad_request" }, 400);
}
