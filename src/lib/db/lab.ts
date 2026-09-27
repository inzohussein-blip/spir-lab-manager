import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { adminCookieLid } from "@/lib/license/adminCookie";
import { ADMIN_LICENSE_COOKIE } from "@/lib/license/modules";
import { LabDbError, checkHost, sslFor, toLabError } from "@/lib/sync/pg";
import { getMainDb, type Db } from "./index";

/**
 * A lab's own database for the full admin panel («قاعدة لوحة الإدارة»).
 *
 * A lab code that includes the admin panel may be given a PostgreSQL of its own (by the owner in
 * /licenses, or by the lab's admin in Settings). The device's admin-panel cookie names the code,
 * so every request from that lab reads and writes its own database; a code without one keeps
 * using the site's database. The tables are created on first use from this repo's migrations
 * (the codes' own tables are left out), and each migration is recorded so it runs only once.
 */

export interface LabDbTarget {
  lid: string;
  conn: string;
  /** Code + database: a login belongs to it, so changing the database asks to sign in again. */
  key: string;
}

type Pool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  connect: () => Promise<{ query: Pool["query"]; release: () => void }>;
};
interface Entry { pool: Promise<Pool>; ready?: Promise<void> }
const g = globalThis as unknown as {
  __adminDbCfg?: Map<string, { conn: string | null; at: number }>;
  __adminDbPools?: Map<string, Entry>;
};
const configs = (g.__adminDbCfg ??= new Map());
const pools = (g.__adminDbPools ??= new Map());
/** When a lab's database last dropped a query for connection trouble (by connection-string hash). */
const failures = ((g as { __adminDbFail?: Map<string, number> }).__adminDbFail ??= new Map());
/** When a lab's database state was last written to its code (so the owner sees it), by code. */
const reported = ((g as { __adminDbReported?: Map<string, { at: number; ok: boolean }> }).__adminDbReported ??= new Map());

/** How long a code's setting is trusted before it is read again (every server instance). */
const CONFIG_TTL_MS = 20_000;
const DATE_OIDS = [1082, 1083, 1114, 1184, 1266];
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** The code's database, or null for the site's own (a stale answer is used while the codes'
 *  database does not answer; with none at all the request fails rather than write elsewhere). */
async function configFor(lid: string): Promise<string | null> {
  const hit = configs.get(lid);
  if (hit && Date.now() - hit.at < CONFIG_TTL_MS) return hit.conn;
  try {
    const { getAdminDb } = await import("@/lib/license/server");
    const conn = (await getAdminDb(lid))?.conn ?? null;
    configs.set(lid, { conn, at: Date.now() });
    return conn;
  } catch (err) {
    if (hit) return hit.conn;
    throw new LabDbError("unreachable", err instanceof Error ? err.message : "codes database");
  }
}

/** Forget what was read about a code (after its database is set or removed on this instance). */
export function forgetAdminDb(lid: string) {
  configs.delete(lid);
}

/** The lab code of this device's admin-panel cookie (null: none, or outside a request). */
export const labCodeId = cache(async (): Promise<string | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(ADMIN_LICENSE_COOKIE)?.value;
  } catch {
    return null; // outside a request (build, background work)
  }
  return adminCookieLid(token);
});

/** Which lab database this request uses (null: the site's own). Once per request. */
export const labTarget = cache(async (): Promise<LabDbTarget | null> => {
  const lid = await labCodeId();
  if (!lid) return null;
  const conn = await configFor(lid);
  return conn ? { lid, conn, key: `${lid}:${hash(conn).slice(0, 16)}` } : null;
});

/** Migrations for the admin panel's tables — the codes' own tables stay in the codes' database. */
function adminMigrations(): { name: string; sql: string }[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !/licen/i.test(f))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8") }));
}

async function ensureSchema(pool: Pool) {
  await pool.query(
    `create table if not exists lab_admin_migrations (name text primary key, applied_at timestamptz not null default now())`
  );
  const client = await pool.connect();
  try {
    await client.query("begin");
    // One server instance at a time prepares a database.
    await client.query("select pg_advisory_xact_lock(hashtext('lab_admin_migrations'))");
    const done = new Set((await client.query(`select name from lab_admin_migrations`)).rows.map((r) => String(r.name)));
    const all = adminMigrations();
    if (!done.size) {
      // A database that already has the panel's tables (prepared by hand, or a copy of another)
      // is taken as it is: its migrations are only recorded.
      const has = await client.query(`select to_regclass('public.app_users') is not null as ok`);
      if (has.rows[0]?.ok) {
        for (const m of all) await client.query(`insert into lab_admin_migrations (name) values ($1) on conflict do nothing`, [m.name]);
        await client.query("commit");
        return;
      }
    }
    for (const m of all) {
      if (done.has(m.name)) continue;
      await client.query(m.sql);
      await client.query(`insert into lab_admin_migrations (name) values ($1)`, [m.name]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** A pool on the lab's database, with its tables ready. */
export async function labPool(conn: string): Promise<Pool> {
  let u: URL;
  try { u = new URL(conn); } catch { throw new LabDbError("bad_url", "bad url"); }
  if (!/^postgres(ql)?:$/.test(u.protocol) || !u.hostname) throw new LabDbError("bad_url", "bad url");
  await checkHost(u.hostname);
  const key = hash(conn);
  let e = pools.get(key);
  if (!e) {
    const ssl = sslFor(u);
    ["sslmode", "uselibpqcompat", "channel_binding"].forEach((p) => u.searchParams.delete(p));
    e = {
      pool: import("pg").then(({ Pool, types }) => {
        for (const oid of DATE_OIDS) types.setTypeParser(oid, (v: string) => v);
        const pool = new Pool({
          connectionString: u.toString(), ssl, max: Number(process.env.LAB_ADMIN_PGPOOL_MAX || 3),
          idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000, statement_timeout: 30_000, query_timeout: 35_000,
        });
        pool.on("error", () => undefined); // a dropped idle connection is replaced on the next query
        return pool as unknown as Pool;
      }),
    };
    pools.set(key, e);
  }
  const entry = e;
  const pool = await entry.pool;
  entry.ready ??= ensureSchema(pool).catch((err) => { entry.ready = undefined; throw err; });
  try { await entry.ready; } catch (err) { throw toLabError(err); }
  return pool;
}

export async function labDb(conn: string): Promise<Db> {
  const pool = await labPool(conn);
  return {
    async query(sql, params) {
      try {
        const r = await pool.query(sql, params as unknown[]);
        return { rows: r.rows as never[], affectedRows: r.rowCount ?? undefined };
      } catch (err) {
        // Connection trouble is told apart from an error in the query itself.
        const e = toLabError(err);
        if (e.code === "db") throw err;
        failures.set(hash(conn), Date.now());
        throw e;
      }
    },
  };
}

/** Set (or create) an admin account in a lab's database — the owner's way back in for a lab. */
export async function resetLabAdmin(conn: string, username: string, password: string): Promise<{ created: boolean }> {
  try {
    const pool = await labPool(conn);
    const r = await pool.query(
      `insert into app_users (username, password_hash, full_name, role, is_active)
       values ($1, crypt($2, gen_salt('bf')), 'مدير المختبر', 'admin', true)
       on conflict (username) do update set password_hash = excluded.password_hash, role = 'admin', is_active = true
       returning (xmax = 0) as created`,
      [username, password]
    );
    return { created: !!r.rows[0]?.created };
  } catch (err) {
    throw toLabError(err);
  }
}

/** Tables that belong to the codes or to the machinery, never copied between databases. */
const NOT_COPIED = /^(lab_admin_migrations|lab_sync_records|station_licenses|license_.*)$/;
const COPY_BATCH = 500;

/**
 * Copy what the panel's current database holds (the site's, or the lab's previous one) into a
 * lab's database (records already there are kept).
 * Tables go parents first; the lab's own triggers (result flags, stock deduction) are paused so
 * copied results do not act twice. All or nothing.
 */
export async function copyInto(conn: string, fromConn: string | null): Promise<{ tables: number; rows: number }> {
  const pool = await labPool(conn);
  const main = fromConn ? await labDb(fromConn) : await getMainDb();
  const tablesOf = async (q: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>) =>
    new Set((await q(`select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`)).rows.map((r) => String(r.t)));
  const colsOf = async (q: (sql: string, p: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>, t: string) =>
    (await q(`select column_name as c from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [t])).rows.map((r) => String(r.c));
  const mainQ = (sql: string, p?: unknown[]) => main.query<Record<string, unknown>>(sql, p);
  const labQ = (sql: string, p?: unknown[]) => pool.query(sql, p);

  const inMain = await tablesOf(mainQ);
  const tables = [...(await tablesOf(labQ))].filter((t) => inMain.has(t) && !NOT_COPIED.test(t));
  // Parents before children (foreign keys between these tables).
  const edges = (await labQ(`select conrelid::regclass::text as child, confrelid::regclass::text as parent
    from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`)).rows
    .map((r) => [String(r.child).replace(/^public\./, ""), String(r.parent).replace(/^public\./, "")] as const);
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (t: string, path: Set<string>) => {
    if (seen.has(t) || path.has(t)) return;
    path.add(t);
    for (const [c, p] of edges) if (c === t && p !== t && tables.includes(p)) visit(p, path);
    path.delete(t);
    seen.add(t); order.push(t);
  };
  for (const t of [...tables].sort()) visit(t, new Set());

  const client = await pool.connect();
  let rows = 0;
  try {
    await client.query("begin");
    for (const t of order) await client.query(`alter table "${t}" disable trigger user`);
    for (const t of order) {
      const labCols = new Set(await colsOf(labQ, t));
      const cols = (await colsOf(mainQ, t)).filter((c) => labCols.has(c));
      if (!cols.length) continue;
      const list = cols.map((c) => `"${c}"`).join(", ");
      for (let off = 0; ; off += COPY_BATCH) {
        const page = (await main.query<Record<string, unknown>>(`select ${list} from "${t}" order by 1 limit ${COPY_BATCH} offset ${off}`)).rows;
        if (!page.length) break;
        const r = await client.query(
          `insert into "${t}" (${list}) select ${list} from jsonb_populate_recordset(null::"${t}", $1::jsonb) on conflict do nothing`,
          [JSON.stringify(page)]
        );
        rows += r.rowCount ?? 0;
        if (page.length < COPY_BATCH) break;
      }
    }
    for (const t of order) await client.query(`alter table "${t}" enable trigger user`);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw toLabError(err);
  } finally {
    client.release();
  }
  return { tables: order.length, rows };
}

/** Prepare a database for a lab (tables, and the first admin when it has no users yet). */
export async function prepareLabDb(
  conn: string,
  first?: { username: string; full_name: string; password?: string; password_hash?: string }
): Promise<{ users: number; created: boolean }> {
  try {
    const pool = await labPool(conn);
    let users = Number((await pool.query(`select count(*)::int as n from app_users`)).rows[0]?.n ?? 0);
    let created = false;
    if (!users && first) {
      if (first.password_hash) {
        await pool.query(
          `insert into app_users (username, password_hash, full_name, role) values ($1, $2, $3, 'admin') on conflict (username) do nothing`,
          [first.username, first.password_hash, first.full_name]
        );
      } else {
        await pool.query(
          `insert into app_users (username, password_hash, full_name, role) values ($1, crypt($2, gen_salt('bf')), $3, 'admin') on conflict (username) do nothing`,
          [first.username, first.password ?? "", first.full_name]
        );
      }
      users = 1;
      created = true;
    }
    return { users, created };
  } catch (err) {
    throw toLabError(err);
  }
}

/** For the panel's layout: null when this request's database is ready, else why it is not. */
export async function labDbProblem(): Promise<{ code: LabDbError["code"]; host: string } | null> {
  let t: LabDbTarget | null = null;
  try {
    t = await labTarget();
    if (!t) return null;
    const pool = await labPool(t.conn);
    // After a recent drop, ask the database again rather than trust the pool.
    const k = hash(t.conn);
    if (Date.now() - (failures.get(k) ?? 0) < 60_000) {
      await pool.query("select 1");
      failures.delete(k);
    }
    void report(t.lid, true, "");
    return null;
  } catch (err) {
    let host = "";
    try { host = t ? new URL(t.conn).hostname : ""; } catch { /* none */ }
    const code = toLabError(err).code;
    if (t) void report(t.lid, false, code);
    return { code, host };
  }
}

/** Tell the owner's list how a lab's database is doing: at once when it changes, otherwise at
 *  most every 30 minutes (per server instance). Never fails the request. */
async function report(lid: string, ok: boolean, error: string) {
  const last = reported.get(lid);
  if (last && last.ok === ok && Date.now() - last.at < 30 * 60_000) return;
  reported.set(lid, { at: Date.now(), ok });
  try {
    const { recordAdminDbCheck } = await import("@/lib/license/server");
    await recordAdminDbCheck(lid, ok, error);
  } catch { /* the owner's list is only a view */ }
}
