import { NextResponse, type NextRequest } from "next/server";
import {
  licensingEnabled, listLicenses, listEvents, createLicense, updateLicense, getContact, setContact, type LicenseAction,
} from "@/lib/license/server";
import { passwordMatches, startOwnerSession, endOwnerSession, isOwner, tooManyTries, noteFail, clearFails, ipOf } from "@/lib/license/owner";

/** Owner endpoints for the code manager (/licenses). */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  if (!licensingEnabled()) return json({ enabled: false, owner: false });
  if (!(await isOwner())) return json({ enabled: true, owner: false });
  return json({ enabled: true, owner: true, licenses: await listLicenses(), events: await listEvents(), contact: await getContact(), now: Date.now() });
}

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return json({ ok: false, error: "disabled" }, 400);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }

  if (b.op === "login") {
    const ip = ipOf(req.headers);
    if (tooManyTries(ip, 8)) return json({ ok: false, error: "too_many" }, 429);
    if (!passwordMatches(String(b.password ?? ""))) {
      noteFail(ip);
      await new Promise((r) => setTimeout(r, 500));
      return json({ ok: false, error: "wrong" }, 401);
    }
    clearFails(ip);
    await startOwnerSession();
    return json({ ok: true });
  }
  if (b.op === "logout") { endOwnerSession(); return json({ ok: true }); }

  if (!(await isOwner())) return json({ ok: false, error: "auth" }, 401);
  if (b.op === "create") {
    const lab = String(b.lab ?? "").trim();
    const days = Number(b.days);
    if (!lab || !Number.isFinite(days) || days < 1) return json({ ok: false, error: "bad_request" }, 400);
    const { row, code } = await createLicense({ lab, days, modules: b.modules, note: String(b.note ?? ""), trial: b.trial === true });
    return json({ ok: true, row, code });
  }
  if (b.op === "update") {
    const r = await updateLicense(String(b.id ?? ""), b.change as LicenseAction);
    return json({ ok: true, ...r });
  }
  if (b.op === "contact") { await setContact(String(b.contact ?? "")); return json({ ok: true }); }
  return json({ ok: false, error: "bad_request" }, 400);
}
