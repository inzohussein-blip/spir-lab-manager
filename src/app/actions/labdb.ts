"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { destroySession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { labCodeId } from "@/lib/db/lab";
import { linkAdminDb, resolveAdminConn, testAdminDb, type AdminDbResult } from "@/lib/license/adminDb";
import { getAdminDb } from "@/lib/license/server";
import { logAudit } from "@/lib/audit";

/**
 * The lab's admin sets its own database for the full admin panel (Settings). Only on a device
 * whose lab code includes the panel, and not over a database the owner set in /licenses.
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
export async function saveLabDb(conn: string | null): Promise<AdminDbResult> {
  const a = await allowed();
  if ("error" in a) return { ok: false, error: a.error };
  let r: AdminDbResult;
  if (conn === null) {
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
    r = await linkAdminDb(a.lid, c, "lab", me);
  }
  if (r.ok) await destroySession();
  return r;
}
