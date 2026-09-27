import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { adminCookieLid } from "@/lib/license/adminCookie";
import { ADMIN_LICENSE_COOKIE } from "@/lib/license/modules";
import { LabDbError, checkHost, sslFor, toLabError } from "@/lib/sync/pg";
import { mainIsEmbedded, mainTx, type Db, type TxConn } from "./index";

/**
 * Where each lab's full admin panel keeps its data.
 *
 * The device's admin-panel cookie names its lab code, and every request from that lab works on:
 *  • the lab's own PostgreSQL, when one is linked (by the owner in /licenses or by the lab); or
 *  • its own section of the site's database — a PostgreSQL schema of its own ("lab_<code>"), so no
 *    lab ever reads or writes another lab's records; or
 *  • nothing, when the owner requires a database of its own for paid codes and this one has none
 *    yet (trial codes keep their section of the site's database). The panel then asks for one.
 * Tables are made on first use from this repo's migrations (the codes' own tables left out), each
 * migration recorded so it runs once.
 */

/** Where a lab's data lives: its own database, or a section (schema) of the site's. */
export type Where = { conn: string } | { schema: string };

export interface LabDbTarget {
  lid: string;
  /** null: the code needs a database of its own first (the owner's rule). */
  where: Where | null;
  /** Code + database: a login belongs to it, so changing the database asks to sign in again. */
  key: string;
}

interface Store {
  tx<T>(fn: (c: TxConn) => Promise<T>): Promise<T>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  /** Close its connections (a lab's own database only; its section of the site's has none). */
  close?: () => Promise<void>;
}
type Route = { conn: string | null; trial: boolean; requireOwn: boolean };
interface Entry { store: Store; ready?: Promise<void> }
const g = globalThis as unknown as {
  __adminDbRoute?: Map<string, { route: Route; at: number }>;
  __adminDbStores?: Map<string, Promise<Entry>>;
  __adminDbUsed?: Map<string, number>;
  __adminDbFail?: Map<string, number>;
  __adminDbReported?: Map<string, { at: number; ok: boolean }>;
};
const routes = (g.__adminDbRoute ??= new Map());
const stores = (g.__adminDbStores ??= new Map());
/** When each lab's own database was last used on this server instance (by store key). */
const lastUsed = (g.__adminDbUsed ??= new Map());

/** Connections to labs' own databases are closed after this long unused, and at most this many
 *  labs keep connections open on one server instance (the least recently used close first). */
const IDLE_CLOSE_MS = Number(process.env.LAB_POOL_IDLE_MIN || 10) * 60_000;
const MAX_OPEN = Number(process.env.LAB_POOLS_MAX || 25);
/** A store used this recently may have a query in flight and is never closed. */
const BUSY_MS = 60_000;
/** When a lab's database last dropped a query for connection trouble (by store key). */
const failures = (g.__adminDbFail ??= new Map());
/** When a lab's database state was last written to its code (so the owner sees it), by code. */
const reported = (g.__adminDbReported ??= new Map());

/** How long a code's setting is trusted before it is read again (every server instance). */
const CONFIG_TTL_MS = 20_000;
const DATE_OIDS = [1082, 1083, 1114, 1184, 1266];
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const qi = (name: string) => `"${name.replace(/"/g, '""')}"`;
/** The site-database section of a lab code. */
export const schemaFor = (lid: string) => `lab_${lid.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)}`;
const whereKey = (w: Where) => ("conn" in w ? `own:${hash(w.conn)}` : `site:${w.schema}`);

/** A code's route (a stale answer is used while the codes' database does not answer; with none
 *  at all the request fails rather than write anywhere else). */
async function routeFor(lid: string): Promise<Route> {
  const hit = routes.get(lid);
  if (hit && Date.now() - hit.at < CONFIG_TTL_MS) return hit.route;
  try {
    const { adminDbRoute } = await import("@/lib/license/server");
    const route = await adminDbRoute(lid);
    routes.set(lid, { route, at: Date.now() });
    return route;
  } catch (err) {
    if (hit) return hit.route;
    throw new LabDbError("unreachable", err instanceof Error ? err.message : "codes database");
  }
}

/** Forget what was read about a code (after its database is set or removed, or the rule changed). */
export function forgetAdminDb(lid?: string) {
  if (lid) routes.delete(lid);
  else routes.clear();
}

/** Where a code's panel works (also without a request, e.g. for /verify?l=). */
export async function targetForCode(lid: string): Promise<LabDbTarget> {
  const r = await routeFor(lid);
  if (r.conn) return { lid, where: { conn: r.conn }, key: `${lid}:${hash(r.conn).slice(0, 16)}` };
  if (r.requireOwn && !r.trial) return { lid, where: null, key: `${lid}:none` };
  return { lid, where: { schema: schemaFor(lid) }, key: `${lid}:site` };
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

/** Where this request works (null: no lab code — the site's own database). Once per request. */
export const labTarget = cache(async (): Promise<LabDbTarget | null> => {
  const lid = await labCodeId();
  return lid ? targetForCode(lid) : null;
});

// ── Stores: a lab's own database (a pool of its own) or its section of the site's ─────────
async function ownStore(conn: string): Promise<Store> {
  let u: URL;
  try { u = new URL(conn); } catch { throw new LabDbError("bad_url", "bad url"); }
  if (!/^postgres(ql)?:$/.test(u.protocol) || !u.hostname) throw new LabDbError("bad_url", "bad url");
  await checkHost(u.hostname);
  const ssl = sslFor(u);
  ["sslmode", "uselibpqcompat", "channel_binding"].forEach((p) => u.searchParams.delete(p));
  const { Pool, types } = await import("pg");
  for (const oid of DATE_OIDS) types.setTypeParser(oid, (v: string) => v);
  const pool = new Pool({
    connectionString: u.toString(), ssl, max: Number(process.env.LAB_ADMIN_PGPOOL_MAX || 3),
    idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000, statement_timeout: 30_000, query_timeout: 35_000,
  });
  pool.on("error", () => undefined); // a dropped idle connection is replaced on the next query
  return {
    close: () => pool.end().catch(() => undefined),
    query: async (sql, params) => { const r = await pool.query(sql, params as unknown[]); return { rows: r.rows, rowCount: r.rowCount }; },
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        const r = await fn({
          query: async (sql, params) => { const x = await c.query(sql, params as unknown[]); return { rows: x.rows, rowCount: x.rowCount }; },
          exec: async (sql) => { await c.query(sql); },
        });
        await c.query("commit");
        return r;
      } catch (err) {
        await c.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        c.release();
      }
    },
  };
}

/** A lab's section of the site's database: every statement runs with only its schema in view
 *  (search_path), inside a transaction, so it works through any connection pooler too. */
function siteStore(schema: string): Store {
  const scoped = <T,>(fn: (c: TxConn) => Promise<T>) =>
    mainTx(async (c) => { await c.query(`set local search_path to ${qi(schema)}`); return fn(c); });
  return { tx: scoped, query: (sql, params) => scoped((c) => c.query(sql, params)) };
}

/** Migrations for the admin panel's tables — the codes' own tables stay in the codes' database. */
function adminMigrations(): { name: string; sql: string }[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !/licen/i.test(f))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8") }));
}

/** pgcrypto's functions the panel uses, reachable from a lab's section (which sees only itself). */
const cryptoWrappers = (s: string, ext: string) => `
create or replace function ${qi(s)}.crypt(text, text) returns text language sql immutable strict as $f$ select ${qi(ext)}.crypt($1, $2) $f$;
create or replace function ${qi(s)}.gen_salt(text) returns text language sql volatile strict as $f$ select ${qi(ext)}.gen_salt($1) $f$;
create or replace function ${qi(s)}.gen_random_bytes(integer) returns bytea language sql volatile strict as $f$ select ${qi(ext)}.gen_random_bytes($1) $f$;`;

async function ensureSchema(store: Store, schema?: string) {
  await store.tx(async (c) => {
    if (schema) {
      await c.query("set local search_path to public");
      await c.exec("create extension if not exists pgcrypto");
      const ext = String((await c.query(
        `select n.nspname as s from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto'`
      )).rows[0]?.s ?? "public");
      await c.exec(`create schema if not exists ${qi(schema)}`);
      await c.query(`set local search_path to ${qi(schema)}`);
      if (ext !== schema) await c.exec(cryptoWrappers(schema, ext));
    }
    // One server instance at a time prepares a database (the embedded one has only this process).
    if (!(schema && mainIsEmbedded())) await c.query("select pg_advisory_xact_lock(hashtext($1))", [`lab_admin_migrations:${schema ?? ""}`]);
    await c.exec(`create table if not exists lab_admin_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const done = new Set((await c.query(`select name from lab_admin_migrations`)).rows.map((r) => String(r.name)));
    const all = adminMigrations();
    if (!done.size) {
      // A database that already has the panel's tables (prepared by hand, or a copy of another)
      // is taken as it is: its migrations are only recorded.
      const has = await c.query(`select to_regclass(quote_ident(current_schema()) || '.app_users') is not null as ok`);
      if (has.rows[0]?.ok) {
        for (const m of all) await c.query(`insert into lab_admin_migrations (name) values ($1) on conflict do nothing`, [m.name]);
        return;
      }
    }
    for (const m of all) {
      if (done.has(m.name)) continue;
      await c.exec(m.sql);
      await c.query(`insert into lab_admin_migrations (name) values ($1)`, [m.name]);
    }
  });
}

/** The store for a place, with the panel's tables ready. The site's shared section ("public") is
 *  read as it is (only to copy old data out of it). */
/** Close the connections of labs' own databases left unused, and of the least recently used
 *  ones beyond MAX_OPEN (they open again on the next request). */
function closeIdle(now: number) {
  const own = [...lastUsed.entries()].filter(([k]) => k.startsWith("own:")).sort((a, b) => a[1] - b[1]);
  let open = own.length;
  for (const [k, used] of own) {
    const idle = now - used;
    if (idle < BUSY_MS || (idle < IDLE_CLOSE_MS && open <= MAX_OPEN)) continue;
    const p = stores.get(k);
    stores.delete(k); lastUsed.delete(k); open--;
    void p?.then((e) => e.store.close?.()).catch(() => undefined);
  }
}

export async function storeOf(w: Where): Promise<Store> {
  const key = whereKey(w);
  const now = Date.now();
  closeIdle(now);
  lastUsed.set(key, now);
  let p = stores.get(key);
  if (!p) {
    p = ("conn" in w ? ownStore(w.conn) : Promise.resolve(siteStore(w.schema))).then((store) => ({ store }));
    p.catch(() => stores.delete(key));
    stores.set(key, p);
  }
  let entry: Entry;
  try { entry = await p; } catch (err) { throw toLabError(err); }
  if ("schema" in w && w.schema === "public") return entry.store;
  const e = entry;
  e.ready ??= ensureSchema(e.store, "schema" in w ? w.schema : undefined).catch((err) => { e.ready = undefined; throw err; });
  try { await e.ready; } catch (err) { throw toLabError(err); }
  return e.store;
}

/** The panel's database for a request's target. */
export async function labDbFor(t: LabDbTarget): Promise<Db> {
  if (!t.where) throw new LabDbError("needs_db", "this code needs a database of its own");
  const w = t.where;
  const store = await storeOf(w);
  return {
    async query(sql, params) {
      try {
        const r = await store.query(sql, params);
        return { rows: r.rows as never[], affectedRows: r.rowCount ?? undefined };
      } catch (err) {
        // Connection trouble is told apart from an error in the query itself.
        const e = toLabError(err);
        if (e.code === "db") throw err;
        failures.set(whereKey(w), Date.now());
        throw e;
      }
    },
  };
}

/** Prepare a lab's database (tables, and the first admin when it has no users yet). */
export async function prepareLabDb(
  w: Where,
  first?: { username: string; full_name: string; password?: string; password_hash?: string }
): Promise<{ users: number; created: boolean }> {
  try {
    const store = await storeOf(w);
    let users = Number((await store.query(`select count(*)::int as n from app_users`)).rows[0]?.n ?? 0);
    let created = false;
    if (!users && first) {
      if (first.password_hash) {
        await store.query(
          `insert into app_users (username, password_hash, full_name, role) values ($1, $2, $3, 'admin') on conflict (username) do nothing`,
          [first.username, first.password_hash, first.full_name]
        );
      } else {
        await store.query(
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

/** Set (or create) an admin account in a lab's database — the owner's way back in for a lab. */
export async function resetLabAdmin(w: Where, username: string, password: string): Promise<{ created: boolean }> {
  try {
    const store = await storeOf(w);
    const r = await store.query(
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
 * Copy what one place holds into a lab's place (records already there are kept): the lab's
 * previous database or section, or the site's old shared data ({ schema: "public" }). Tables go
 * parents first; the lab's own triggers (result flags, stock deduction) are paused so copied
 * results do not act twice. All or nothing.
 */
export async function copyInto(target: Where, source: Where): Promise<{ tables: number; rows: number }> {
  const to = await storeOf(target);
  const from = await storeOf(source);
  const tablesSql = `select table_name as t from information_schema.tables where table_schema = current_schema() and table_type = 'BASE TABLE'`;
  const colsSql = `select column_name as c from information_schema.columns where table_schema = current_schema() and table_name = $1 order by ordinal_position`;
  const names = (rows: Record<string, unknown>[], k: string) => rows.map((r) => String(r[k]));
  // Both in the site's database: one statement per table, inside the target's transaction.
  const sameSite = "schema" in target && "schema" in source;

  try {
    // The source's shape is read before the target's transaction starts (the embedded site
    // database runs one transaction at a time).
    const srcCols = new Map<string, string[]>();
    for (const t of names((await from.query(tablesSql)).rows, "t")) {
      if (!NOT_COPIED.test(t)) srcCols.set(t, names((await from.query(colsSql, [t])).rows, "c"));
    }
    return await to.tx(async (c) => {
      const tables = names((await c.query(tablesSql)).rows, "t").filter((t) => srcCols.has(t));
      const edges = (await c.query(`select conrelid::regclass::text as child, confrelid::regclass::text as parent
        from pg_constraint where contype = 'f' and connamespace = current_schema()::regnamespace`)).rows
        .map((r) => [String(r.child).replace(/^.*\./, "").replace(/"/g, ""), String(r.parent).replace(/^.*\./, "").replace(/"/g, "")] as const);
      // Parents before children (foreign keys between these tables).
      const order: string[] = [];
      const seen = new Set<string>();
      const visit = (t: string, trail: Set<string>) => {
        if (seen.has(t) || trail.has(t)) return;
        trail.add(t);
        for (const [ch, pa] of edges) if (ch === t && pa !== t && tables.includes(pa)) visit(pa, trail);
        trail.delete(t);
        seen.add(t); order.push(t);
      };
      for (const t of [...tables].sort()) visit(t, new Set());

      let rows = 0;
      for (const t of order) await c.exec(`alter table ${qi(t)} disable trigger user`);
      for (const t of order) {
        const have = new Set(names((await c.query(colsSql, [t])).rows, "c"));
        const cols = srcCols.get(t)!.filter((x) => have.has(x));
        if (!cols.length) continue;
        const list = cols.map(qi).join(", ");
        if (sameSite) {
          const src = qi((source as { schema: string }).schema);
          const r = await c.query(`insert into ${qi(t)} (${list}) select ${list} from ${src}.${qi(t)} on conflict do nothing`);
          rows += r.rowCount ?? 0;
          continue;
        }
        for (let off = 0; ; off += COPY_BATCH) {
          const page = (await from.query(`select ${list} from ${qi(t)} order by 1 limit ${COPY_BATCH} offset ${off}`)).rows;
          if (!page.length) break;
          const r = await c.query(
            `insert into ${qi(t)} (${list}) select ${list} from jsonb_populate_recordset(null::${qi(t)}, $1::jsonb) on conflict do nothing`,
            [JSON.stringify(page)]
          );
          rows += r.rowCount ?? 0;
          if (page.length < COPY_BATCH) break;
        }
      }
      for (const t of order) await c.exec(`alter table ${qi(t)} enable trigger user`);
      return { tables: order.length, rows };
    });
  } catch (err) {
    throw toLabError(err);
  }
}

/** Rows read per table for an export (a larger table is cut, and says so). */
const EXPORT_MAX_ROWS = 50_000;

/** Every table of a lab's place, for the owner's export: columns and rows (as text or numbers). */
export interface TableDump { name: string; cols: string[]; rows: (string | number | null)[][]; cut: boolean }
export async function readAllTables(w: Where): Promise<TableDump[]> {
  try {
    const store = await storeOf(w);
    const tables = (await store.query(
      `select table_name as t from information_schema.tables where table_schema = current_schema() and table_type = 'BASE TABLE' order by 1`
    )).rows.map((r) => String(r.t)).filter((t) => !NOT_COPIED.test(t));
    const out: TableDump[] = [];
    for (const t of tables) {
      const r = await store.query(`select * from ${qi(t)} order by 1 limit ${EXPORT_MAX_ROWS + 1}`);
      const cols = r.rows[0] ? Object.keys(r.rows[0]) : [];
      const cell = (v: unknown): string | number | null =>
        v == null ? null : typeof v === "number" ? v : typeof v === "boolean" ? (v ? "نعم" : "لا")
        : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
      out.push({ name: t, cols, rows: r.rows.slice(0, EXPORT_MAX_ROWS).map((row) => cols.map((c) => cell(row[c]))), cut: r.rows.length > EXPORT_MAX_ROWS });
    }
    return out;
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
    if (!t.where) return { code: "needs_db", host: "" };
    const store = await storeOf(t.where);
    // After a recent drop, ask the database again rather than trust the pool.
    const k = whereKey(t.where);
    if (Date.now() - (failures.get(k) ?? 0) < 60_000) {
      await store.query("select 1");
      failures.delete(k);
    }
    if ("conn" in t.where) void report(t.lid, true, "");
    return null;
  } catch (err) {
    let host = "";
    try { host = t?.where && "conn" in t.where ? new URL(t.where.conn).hostname : ""; } catch { /* none */ }
    const code = toLabError(err).code;
    if (t?.where && "conn" in t.where) void report(t.lid, false, code);
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
