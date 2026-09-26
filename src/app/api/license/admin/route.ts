import { NextResponse, type NextRequest } from "next/server";
import {
  licensingEnabled, passwordSet, durableStorage, storageStatus, attemptsBlocked, noteAttempt, clearAttempts,
  logOwnerSignIn, ownerSignIns, exportCodes, importCodes, listLicenses, listEvents, createLicense, updateLicense, getContact, setContact, type LicenseAction,
} from "@/lib/license/server";
import { passwordMatches, startOwnerSession, endOwnerSession, isOwner, ipOf } from "@/lib/license/owner";

/** Owner endpoints for the code manager (/licenses). */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  if (!licensingEnabled()) return json({ enabled: false, owner: false, needsDb: passwordSet() && !durableStorage() });
  if (!(await isOwner())) return json({ enabled: true, owner: false });
  const storage = await storageStatus();
  if (!storage.ok) return json({ enabled: true, owner: true, storage, licenses: [], events: [], contact: "", now: Date.now() });
  return json({ enabled: true, owner: true, storage, licenses: await listLicenses(), events: await listEvents(), signIns: await ownerSignIns(), contact: await getContact(), now: Date.now() });
}

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return json({ ok: false, error: "disabled" }, 400);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }

  if (b.op === "login") {
    const ip = ipOf(req.headers);
    const agent = req.headers.get("user-agent") ?? "";
    if (await attemptsBlocked("owner", ip, 8)) { await logOwnerSignIn(false, ip, agent); return json({ ok: false, error: "too_many" }, 429); }
    if (!passwordMatches(String(b.password ?? ""))) {
      await noteAttempt("owner", ip);
      await logOwnerSignIn(false, ip, agent);
      await new Promise((r) => setTimeout(r, 500));
      return json({ ok: false, error: "wrong" }, 401);
    }
    await clearAttempts("owner", ip);
    await logOwnerSignIn(true, ip, agent);
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
  if (b.op === "backup") return json({ ok: true, backup: await exportCodes() });
  if (b.op === "restore") {
    try { return json({ ok: true, ...(await importCodes(b.backup)) }); }
    catch { return json({ ok: false, error: "invalid" }, 400); }
  }
  if (b.op === "selftest") return json({ ok: true, storage: await storageStatus(true) });
  if (b.op === "contact") { await setContact(String(b.contact ?? "")); return json({ ok: true }); }
  return json({ ok: false, error: "bad_request" }, 400);
}
