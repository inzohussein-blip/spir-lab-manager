import { NextResponse, type NextRequest } from "next/server";
import {
  licensingEnabled, passwordSet, durableStorage, storageStatus, attemptsBlocked, noteAttempt, clearAttempts,
  logOwnerSignIn, ownerSignIns, signingKeySealed,
  twoFactorStatus, twoFactorRequired, checkOwnerCode, startTwoFactorSetup, confirmTwoFactor, disableTwoFactor, exportCodes, importCodes, listLicenses, listEvents, createLicense, updateLicense, getContact, setContact, type LicenseAction,
  getSyncConfig, setSyncConfig, cleanSyncConfig, getAdminDb, getPrefs, setPrefs,
} from "@/lib/license/server";
import { LabDbError, probe } from "@/lib/sync/pg";
import { SupaError, supaProbe, supaSignIn } from "@/lib/sync/supabase";
import { connHost, type SyncConfig } from "@/lib/sync/protocol";
import { cleanFirstAdmin, linkAdminDb, resolveAdminConn, testAdminDb } from "@/lib/license/adminDb";
import { passwordMatches, startOwnerSession, endOwnerSession, isOwner, ipOf } from "@/lib/license/owner";

/** Owner endpoints for the code manager (/licenses). */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  if (!licensingEnabled()) return json({ enabled: false, owner: false, needsDb: passwordSet() && !durableStorage() });
  if (!(await isOwner())) return json({ enabled: true, owner: false });
  const storage = await storageStatus();
  if (!storage.ok) return json({ enabled: true, owner: true, storage, licenses: [], events: [], contact: "", now: Date.now() });
  return json({ enabled: true, owner: true, storage: { ...storage, keySealed: await signingKeySealed() }, licenses: await listLicenses(), events: await listEvents(), signIns: await ownerSignIns(), twoFactor: await twoFactorStatus(), contact: await getContact(), prefs: await getPrefs(), version: process.env.LAB_VERSION ?? "", now: Date.now() });
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
  if (b.op === "prefs") return json({ ok: true, prefs: await setPrefs(b.prefs) });

  // The lab's own database: see it (never the password or the connection string), test it, link it.
  if (b.op === "sync_get") {
    const s = await getSyncConfig(String(b.id ?? ""));
    if (!s) return json({ ok: true, config: null });
    const c = s.cfg;
    return json({ ok: true, by: s.by, config: c.kind === "postgres" ? { kind: "postgres", host: connHost(c.conn) } : { kind: "supabase", url: c.url, anonKey: c.anonKey, email: c.email } });
  }
  // Several devices of one lab: link this code to the same database as another code.
  if (b.op === "sync_copy") {
    const from = await getSyncConfig(String(b.from ?? ""));
    if (!from) return json({ ok: false, error: "bad_config" }, 400);
    const err = await setSyncConfig(String(b.id ?? ""), from.cfg, "owner");
    return err ? json({ ok: false, error: err }, 400) : json({ ok: true });
  }
  if (b.op === "sync_test" || b.op === "sync_set") {
    const id = String(b.id ?? "");
    if (b.op === "sync_set" && b.config == null) {
      const err = await setSyncConfig(id, null, "owner");
      return err ? json({ ok: false, error: err }, 400) : json({ ok: true });
    }
    // Left empty in the form: keep what is saved (the owner never sees it again).
    const saved = id ? await getSyncConfig(id) : null;
    const raw = { ...(b.config as Record<string, unknown>) };
    if (saved?.cfg.kind === "supabase" && raw.kind === "supabase" && !raw.password) raw.password = saved.cfg.password;
    if (saved?.cfg.kind === "postgres" && raw.kind === "postgres" && !raw.conn) raw.conn = saved.cfg.conn;
    const cfg = cleanSyncConfig(raw);
    if (!cfg) return json({ ok: false, error: "bad_config" }, 400);
    const tested = await testSync(cfg);
    if (!tested.ok) return json(tested, 502);
    if (b.op === "sync_test") return json(tested);
    const err = await setSyncConfig(id, cfg, "owner");
    return err ? json({ ok: false, error: err }, 400) : json(tested);
  }
  // The full admin panel's own database for a code (the connection string never comes back).
  if (b.op === "admin_db_test" || b.op === "admin_db_set") {
    const id = String(b.id ?? "");
    if (b.op === "admin_db_set" && b.conn === null) {
      const r = await linkAdminDb(id, null, "owner");
      return json(r, r.ok ? 200 : 400);
    }
    const conn = b.from ? (await getAdminDb(String(b.from)))?.conn ?? null : await resolveAdminConn(id, b.conn, !!b.fromSync);
    if (!conn) return json({ ok: false, error: "bad_config" }, 400);
    if (b.op === "admin_db_test") { const r = await testAdminDb(conn); return json(r, r.ok ? 200 : 502); }
    const first = cleanFirstAdmin(b.first);
    if (first === "bad") return json({ ok: false, error: "bad_account" }, 400);
    const r = await linkAdminDb(id, conn, "owner", first);
    return json(r, r.ok ? 200 : r.error === "no_admin" ? 409 : 502);
  }
  return json({ ok: false, error: "bad_request" }, 400);
}

/** Open the lab's database as its devices will: sign-in and table for Supabase, connection for PostgreSQL. */
async function testSync(cfg: SyncConfig): Promise<{ ok: true; records: number } | { ok: false; error: string }> {
  try {
    if (cfg.kind === "postgres") return { ok: true, records: (await probe(cfg.conn)).records };
    return { ok: true, records: (await supaProbe(cfg, await supaSignIn(cfg))).records };
  } catch (e) {
    return { ok: false, error: e instanceof LabDbError || e instanceof SupaError ? e.code : "db" };
  }
}
