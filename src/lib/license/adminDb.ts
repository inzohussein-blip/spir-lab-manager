import "server-only";
import { forgetAdminDb, prepareLabDb } from "@/lib/db/lab";
import { LabDbError } from "@/lib/sync/pg";
import { isPostgresUrl } from "@/lib/sync/protocol";
import { getAdminDb, getSyncConfig, setAdminDb } from "./server";

/**
 * Setting a lab's own database for its full admin panel — shared by the owner (/licenses) and the
 * lab's admin (Settings). The database is opened and its tables made before it is saved, and it
 * must end up with an admin account, or nobody could sign in to the panel afterwards.
 */

export type AdminDbResult =
  | { ok: true; users: number; created?: boolean }
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
    return { ok: true, users: (await prepareLabDb(conn)).users };
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

/** Save it for the code (null: back to the site's database). */
export async function linkAdminDb(id: string, conn: string | null, by: "owner" | "lab", first?: FirstAdmin | null): Promise<AdminDbResult> {
  if (!conn) {
    const err = await setAdminDb(id, null, by);
    forgetAdminDb(id);
    return err ? { ok: false, error: err } : { ok: true, users: 0 };
  }
  let prepared: { users: number; created: boolean };
  try {
    prepared = await prepareLabDb(conn, first ?? undefined);
  } catch (e) {
    return { ok: false, error: errOf(e) };
  }
  if (!prepared.users) return { ok: false, error: "no_admin" };
  const err = await setAdminDb(id, conn, by);
  forgetAdminDb(id);
  return err ? { ok: false, error: err } : { ok: true, users: prepared.users, created: prepared.created };
}
