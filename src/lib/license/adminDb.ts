import "server-only";
import { copyInto, forgetAdminDb, prepareLabDb, readAllTables, resetLabAdmin, targetForCode } from "@/lib/db/lab";
import { xlsx, type Sheet } from "@/lib/xlsx";
import { LabDbError } from "@/lib/sync/pg";
import { isPostgresUrl } from "@/lib/sync/protocol";
import { getAdminDb, getSyncConfig, licenseLabName, noteLicenseEvent, recordAdminDbCheck, setAdminDb } from "./server";

/**
 * Setting a lab's own database for its full admin panel — shared by the owner (/licenses) and the
 * lab's admin (Settings). The database is opened and its tables made before it is saved, and it
 * must end up with an admin account, or nobody could sign in to the panel afterwards.
 */

export type AdminDbResult =
  | { ok: true; users: number; created?: boolean; copied?: { tables: number; rows: number } }
  | { ok: false; error: string };

export interface FirstAdmin { username: string; full_name: string; password?: string; password_hash?: string }

/** The connection string to use: the one typed, else the saved one, else (asked) the lab's sync database. */
export async function resolveAdminConn(id: string, typed: unknown, fromSync = false): Promise<string | null> {
  const t = String(typed ?? "").trim();
  if (t) return isPostgresUrl(t) && t.length <= 1000 ? t : null;
  if (fromSync) {
    const s = await getSyncConfig(id);
    return s?.cfg.kind === "postgres" ? s.cfg.conn : null;
  }
  return (await getAdminDb(id))?.conn ?? null;
}

const errOf = (e: unknown) => (e instanceof LabDbError ? e.code : "db");

export async function testAdminDb(conn: string): Promise<AdminDbResult> {
  try {
    return { ok: true, users: (await prepareLabDb({ conn })).users };
  } catch (e) {
    return { ok: false, error: errOf(e) };
  }
}

export function cleanFirstAdmin(v: unknown): FirstAdmin | null | "bad" {
  const a = v as Record<string, unknown> | null;
  if (!a || typeof a !== "object" || (!a.username && !a.password)) return null;
  const username = String(a.username ?? "").trim(), password = String(a.password ?? "");
  if (!/^[\p{L}\p{N}._-]{2,40}$/u.test(username) || password.length < 6 || password.length > 200) return "bad";
  return { username, password, full_name: String(a.full_name ?? "").trim().slice(0, 80) || "مدير المختبر" };
}

/** Check the code's saved database and keep the result for the owner's list. */
export async function checkSavedAdminDb(id: string): Promise<AdminDbResult> {
  const saved = await getAdminDb(id);
  if (!saved) return { ok: false, error: "bad_config" };
  const r = await testAdminDb(saved.conn);
  await recordAdminDbCheck(id, r.ok, r.ok ? "" : r.error).catch(() => undefined);
  return r;
}

/** The owner sets a new password for an admin of the lab (created when the name is new) — in
 *  the lab's own database or its section of the site's. */
export async function resetAdminPassword(id: string, v: unknown): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const a = cleanFirstAdmin(v);
  if (!a || a === "bad") return { ok: false, error: "bad_account" };
  try {
    const t = await targetForCode(id);
    if (!t.where) return { ok: false, error: "needs_db" };
    return { ok: true, ...(await resetLabAdmin(t.where, a.username, a.password!)) };
  } catch (e) {
    return { ok: false, error: errOf(e) };
  }
}

/** Bring the site's old shared data (from before each lab had its own section) into a code's
 *  place — for the lab that used the panel then. Records already there are kept. */
export async function importShared(id: string): Promise<AdminDbResult> {
  try {
    const t = await targetForCode(id);
    if (!t.where) return { ok: false, error: "needs_db" };
    const copied = await copyInto(t.where, { schema: "public" });
    return { ok: true, users: (await prepareLabDb(t.where)).users, copied };
  } catch (e) {
    return { ok: false, error: errOf(e) };
  }
}

/** Save it for the code (null: back to its section of the site's database). With `copy`, what
 *  the panel's current place holds (its section, or its previous database) is copied into it
 *  first. `allowNoAdmin`: the lab sets it from the panel's first screen and creates its first
 *  admin right after (see the login's first-run form). */
export async function linkAdminDb(id: string, conn: string | null, by: "owner" | "lab", first?: FirstAdmin | null, copy = false, allowNoAdmin = false): Promise<AdminDbResult> {
  if (!conn) {
    const err = await setAdminDb(id, null, by);
    forgetAdminDb(id);
    return err ? { ok: false, error: err } : { ok: true, users: 0 };
  }
  let prepared: { users: number; created: boolean };
  let copied: { tables: number; rows: number } | undefined;
  try {
    await prepareLabDb({ conn });
    const current = copy ? (await targetForCode(id)).where : null;
    if (current && !("conn" in current && current.conn === conn)) copied = await copyInto({ conn }, current);
    prepared = await prepareLabDb({ conn }, first ?? undefined);
  } catch (e) {
    return { ok: false, error: errOf(e) };
  }
  if (!prepared.users && !allowNoAdmin) return { ok: false, error: "no_admin" };
  const err = await setAdminDb(id, conn, by);
  forgetAdminDb(id);
  return err ? { ok: false, error: err } : { ok: true, users: prepared.users, created: prepared.created, copied };
}

/** Readable names for the panel's tables on the export's sheets (others keep their own name). */
const TABLE_AR: Record<string, string> = {
  patients: "المرضى", test_orders: "الطلبات", test_order_items: "فحوص الطلبات", test_results: "النتائج", test_catalog: "كتالوج الفحوصات",
  invoices: "الفواتير", invoice_items: "بنود الفواتير", payments: "الدفعات", products: "المخزون", stock_movements: "حركة المخزون",
  suppliers: "الموردون", purchase_orders: "أوامر الشراء", purchase_order_items: "بنود الشراء", expenses: "المصروفات", staff: "الكادر",
  shifts: "المناوبات", cover_shifts: "البدلاء", referrers: "الأطباء المحيلون", appointments: "المواعيد", reports: "التقارير",
  qc_runs: "السيطرة النوعية", app_users: "المستخدمون", audit_log: "سجل التدقيق", lab_settings: "إعدادات المختبر", whatsapp_log: "سجل الرسائل",
};

/** The owner's export of a lab's admin-panel data as an Excel workbook (a sheet per table; account
 *  passwords are left out). Nothing is written to the lab's own records. */
export async function exportLabData(id: string): Promise<{ ok: true; file: string; name: string; tables: number; rows: number } | { ok: false; error: string }> {
  try {
    const lab = await licenseLabName(id);
    if (lab == null) return { ok: false, error: "not_found" };
    const t = await targetForCode(id);
    if (!t.where) return { ok: false, error: "needs_db" };
    const tables = await readAllTables(t.where);
    const date = new Date().toISOString().slice(0, 10);
    let rows = 0;
    const sheets: Sheet[] = [{
      name: "معلومات",
      rows: [["المختبر", lab], ["تاريخ التصدير", date], ["المصدر", "conn" in t.where ? "قاعدة المختبر الخاصة" : "قسمه في قاعدة الموقع"], [],
        ["الجدول", "عدد السجلات", "ملاحظة"],
        ...tables.map((x) => [TABLE_AR[x.name] ?? x.name, x.rows.length, x.cut ? "أول 50000 سجل فقط" : ""])],
    }];
    for (const x of tables) {
      const hide = x.name === "app_users" ? new Set(["password_hash"]) : new Set<string>();
      const keep = x.cols.map((c, i) => [c, i] as const).filter(([c]) => !hide.has(c));
      sheets.push({ name: TABLE_AR[x.name] ?? x.name, rows: [keep.map(([c]) => c), ...x.rows.map((r) => keep.map(([, i]) => r[i]))] });
      rows += x.rows.length;
    }
    const file = Buffer.from(xlsx(sheets)).toString("base64");
    await noteLicenseEvent(id, "data_export", `${tables.length} جدولاً · ${rows} سجلاً`);
    // A plain file name (some browsers drop names with Arabic); the lab's name is on the first sheet.
    return { ok: true, file, name: `lab-data-${id.replace(/[^\w]/g, "").slice(0, 8)}-${date}.xlsx`, tables: tables.length, rows };
  } catch (e) {
    return { ok: false, error: errOf(e) };
  }
}
