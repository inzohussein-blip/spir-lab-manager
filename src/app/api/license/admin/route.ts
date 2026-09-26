import { NextResponse, type NextRequest } from "next/server";
import {
  licensingEnabled, passwordSet, durableStorage, storageStatus, attemptsBlocked, noteAttempt, clearAttempts,
  logOwnerSignIn, ownerSignIns, signingKeySealed,
  twoFactorStatus, twoFactorRequired, checkOwnerCode, startTwoFactorSetup, confirmTwoFactor, disableTwoFactor, exportCodes, importCodes, listLicenses, listEvents, createLicense, updateLicense, getContact, setContact, type LicenseAction,
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
  return json({ enabled: true, owner: true, storage: { ...storage, keySealed: await signingKeySealed() }, licenses: await listLicenses(), events: await listEvents(), signIns: await ownerSignIns(), twoFactor: await twoFactorStatus(), contact: await getContact(), now: Date.now() });
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
    // Second step (authenticator app), when set up: the password alone asks for the code.
    if (await twoFactorRequired()) {
      const code = String(b.code ?? "").trim();
      if (!code) return json({ ok: false, error: "need_code" }, 401);
      if (!(await checkOwnerCode(code))) {
        await noteAttempt("owner", ip);
        await logOwnerSignIn(false, ip, agent);
        await new Promise((r) => setTimeout(r, 500));
        return json({ ok: false, error: "wrong_code" }, 401);
      }
    }
    await clearAttempts("owner", ip);
    await logOwnerSignIn(true, ip, agent);
    await startOwnerSession();
    return json({ ok: true });
  }
  if (b.op === "logout") { await endOwnerSession(); return json({ ok: true }); }

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
  if (b.op === "totp_setup") {
    const r = await startTwoFactorSetup();
    if (!r) return json({ ok: false, error: "no_secret" }, 400);
    const QRCode = (await import("qrcode")).default;
    return json({ ok: true, secret: r.secret, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 220, errorCorrectionLevel: "M" }) });
  }
  if (b.op === "totp_enable") return (await confirmTwoFactor(String(b.code ?? ""))) ? json({ ok: true }) : json({ ok: false, error: "wrong_code" }, 400);
  if (b.op === "totp_disable") return (await disableTwoFactor(String(b.code ?? ""))) ? json({ ok: true }) : json({ ok: false, error: "wrong_code" }, 400);
  if (b.op === "contact") { await setContact(String(b.contact ?? "")); return json({ ok: true }); }
  return json({ ok: false, error: "bad_request" }, 400);
}
