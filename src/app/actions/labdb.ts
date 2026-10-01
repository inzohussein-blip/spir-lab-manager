"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { destroySession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { labCodeId, targetForCode } from "@/lib/db/lab";
import { linkAdminDb, resolveAdminConn, testAdminDb, type AdminDbResult } from "@/lib/license/adminDb";
import { getAdminDb } from "@/lib/license/server";
import { logAudit } from "@/lib/audit";

/**
 * The lab's admin sets its own database for the full admin panel (Settings). Only on a device
 * whose lab code includes the panel, and not over a database the owner set in /license.
 */
async function allowed(): Promise<{ lid: string; userId: string } | { error: string }> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return { error: "forbidden" };
  const lid = await labCodeId();
  if (!lid) return { error: "no_code" };
  if ((await getAdminDb(lid))?.by === "owner") return { error: "owner_set" };
  return { lid, userId: u.id };
}

export async function testLabDb(conn: string): Promise<AdminDbResult> {
  const a = await allowed();
  if ("error" in a) return { ok: false, error: a.error };
  const c = await resolveAdminConn(a.lid, conn);
  if (!c) return { ok: false, error: "bad_config" };
  return testAdminDb(c);
}

/** Save (conn) or go back to the site's database (null). The admin signs in again afterwards. */
export async function saveLabDb(conn: string | null, copy = false): Promise<AdminDbResult> {
  const a = await allowed();
  if ("error" in a) return { ok: false, error: a.error };
  let r: AdminDbResult;
  if (conn === null) {
    const { adminDbRoute } = await import("@/lib/license/server");
    const route = await adminDbRoute(a.lid);
    if (route.requireOwn && !route.trial) return { ok: false, error: "needs_db_rule" };
    await logAudit("settings.lab_db", "settings", null, { to: "site" });
    r = await linkAdminDb(a.lid, null, "lab");
  } else {
    const c = await resolveAdminConn(a.lid, conn);
    if (!c) return { ok: false, error: "bad_config" };
    // A new database gets this admin's own account (same user name and password).
    const me = await queryOne<{ username: string; password_hash: string; full_name: string }>(
      `select username, password_hash, full_name from app_users where id = $1`, [a.userId]
    );
    await logAudit("settings.lab_db", "settings", null, { to: "lab" });
    r = await linkAdminDb(a.lid, c, "lab", me, copy);
  }
  if (r.ok) await destroySession();
  return r;
}

/** Adds the built-in test list (the Lab Station's) to this panel's catalogue; tests whose code
 *  is already there are left as they are. Admin only. */
export async function importDefaultTests(): Promise<{ ok: true; added: number; total: number } | { ok: false; error: string }> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return { ok: false, error: "forbidden" };
  const { DEFAULT_TESTS } = await import("@/lib/station/defaultTests");
  const r = (n: number | null) => (n == null ? "" : String(n));
  const rows = DEFAULT_TESTS().map((t) => {
    const n = t.normal;
    const range =
      n.kind === "numeric" ? { low: n.low, high: n.high, text: n.note ?? null }
      : n.kind === "sex" ? { low: null, high: null, text: `ذكور ${r(n.male.low)}–${r(n.male.high)} · إناث ${r(n.female.low)}–${r(n.female.high)}` }
      : n.kind === "qual" || n.kind === "text" ? { low: null, high: null, text: n.text }
      : { low: null, high: null, text: null };
    return {
      code: t.code, name_ar: t.name_ar, name_en: t.name_en ?? null, category: t.category ?? null, sample_type: t.sample_type ?? null,
      unit: t.unit || null, normal_low: range.low, normal_high: range.high, normal_text: range.text, is_special: n.kind === "none",
    };
  });
  const added = await queryOne<{ n: number }>(
    `with ins as (
       insert into test_catalog (code, name_ar, name_en, category, sample_type, unit, normal_low, normal_high, normal_text, is_special)
       select code, name_ar, name_en, category, sample_type, unit, normal_low, normal_high, normal_text, is_special
         from jsonb_to_recordset($1::jsonb) as x(code text, name_ar text, name_en text, category text, sample_type text, unit text,
              normal_low numeric, normal_high numeric, normal_text text, is_special boolean)
       on conflict (code) do nothing
       returning 1)
     select count(*)::int as n from ins`,
    [JSON.stringify(rows)]
  );
  await logAudit("tests.import_defaults", "test_catalog", null, { added: added?.n ?? 0 });
  return { ok: true, added: added?.n ?? 0, total: rows.length };
}

/** The panel's first screen for a code that needs a database of its own: the lab links one
 *  (it then creates its first admin at the sign-in page). Only while the code has none. */
export async function connectFromGate(conn: string): Promise<AdminDbResult> {
  const lid = await labCodeId();
  if (!lid) return { ok: false, error: "no_code" };
  if ((await targetForCode(lid)).where) return { ok: false, error: "forbidden" };
  const c = await resolveAdminConn(lid, conn);
  if (!c) return { ok: false, error: "bad_config" };
  return linkAdminDb(lid, c, "lab", null, false, true);
}
