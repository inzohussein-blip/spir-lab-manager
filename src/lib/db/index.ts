import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Data-source layer for the lab app. One interface, two interchangeable
 * backends:
 *
 *   • Hosted Postgres (node-postgres) — used when DATABASE_URL is set. This is
 *     the production path: point it at a dedicated Postgres/Supabase instance.
 *
 *   • Embedded Postgres (PGlite/WASM) — the fallback when DATABASE_URL is unset.
 *     Applies this repo's SQL migrations + seed in-process. Great for local dev;
 *     on a serverless host (Vercel) its data dir is ephemeral, so it serves as a
 *     zero-config DEMO only — set DATABASE_URL for durable, shared data.
 */

export interface Db {
  query<T = any>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; affectedRows?: number }>;
}

// PGlite needs a writable data dir. The project dir works locally, but on a
// serverless host (Vercel) it is read-only, so we must fall back to a writable
// temp dir. Rather than trust env detection, actually TEST writability and fall
// back on any failure — bulletproof against EROFS. The temp dir is ephemeral
// (per-instance, not shared): a demo fallback until DATABASE_URL is set.
function resolveDataDir(): string {
  const candidates = [
    process.env.PGLITE_DATA_DIR,
    path.join(process.cwd(), ".pglite-data"),
    path.join(os.tmpdir(), "lab-pglite-data"),
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // not writable here — try the next candidate
    }
  }
  // Last resort: a unique temp dir (mkdtemp always targets a writable base).
  return fs.mkdtempSync(path.join(os.tmpdir(), "lab-pglite-"));
}

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const SEED_FILE = path.join(process.cwd(), "supabase", "seed.sql");

// date/time OIDs -> keep as text (matches PostgREST + how pages render them).
const DATE_OIDS = [1082, 1083, 1114, 1184, 1266];

// A single shared connection lives on globalThis, not in module scope: Next.js
// can load this module more than once (RSC + server-action bundles, dev HMR),
// and a per-module handle would open a second PGlite instance against the same
// data dir, making writes on one invisible to reads on the other.
/** One statement (`query`, with parameters) or a script (`exec`, several statements), inside a transaction. */
export interface TxConn {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  exec(sql: string): Promise<void>;
}
type Tx = <T>(fn: (c: TxConn) => Promise<T>) => Promise<T>;

interface DbSingleton {
  dbRef: Db | null;
  initPromise: Promise<Db> | null;
  tx: Tx | null;
  embedded: boolean;
}
const g = globalThis as unknown as { __labDb?: DbSingleton };
const store: DbSingleton = (g.__labDb ??= { dbRef: null, initPromise: null, tx: null, embedded: false });

async function initPg(url: string): Promise<Db> {
  const { Pool, types } = await import("pg");
  for (const oid of DATE_OIDS) types.setTypeParser(oid, (v: string) => v);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PGPOOL_MAX || 5),
    ssl:
      process.env.PGSSL === "disable"
        ? false
        : { rejectUnauthorized: false },
  });
  store.tx = async (fn) => {
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
  };
  return {
    async query(sql, params) {
      const r = await pool.query(sql, params as any[]);
      return { rows: r.rows as any[], affectedRows: r.rowCount ?? undefined };
    },
  };
}

async function initPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const pg = await PGlite.create(resolveDataDir(), {
    extensions: { pgcrypto },
    parsers: Object.fromEntries(DATE_OIDS.map((oid) => [oid, (v: string) => v])),
  });

  // Apply migrations only when the schema is absent (freshness by content, not
  // by dir existence — the temp dir may be recreated empty per instance).
  const check = await pg.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_name = 'app_users'`
  );
  if (!check.rows[0] || check.rows[0].n === 0) {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      await pg.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    }
    if (fs.existsSync(SEED_FILE)) {
      await pg.exec(fs.readFileSync(SEED_FILE, "utf8"));
    }
  }

  store.embedded = true;
  store.tx = (fn) =>
    pg.transaction((t) =>
      fn({
        query: async (sql, params) => { const x = await t.query<Record<string, unknown>>(sql, params as unknown[]); return { rows: x.rows, rowCount: x.affectedRows ?? null }; },
        exec: async (sql) => { await t.exec(sql); },
      })
    );
  return {
    async query(sql, params) {
      const r = await pg.query(sql, params as any[]);
      return { rows: r.rows as any[], affectedRows: r.affectedRows };
    },
  };
}

/** A transaction on the site's own database (a lab's section of it runs inside one, see ./lab.ts). */
export async function mainTx<T>(fn: (c: TxConn) => Promise<T>): Promise<T> {
  await getMainDb();
  return store.tx!(fn);
}
/** The embedded database (one connection in this process, no other server to share it with). */
export const mainIsEmbedded = () => store.embedded;

/** The site's own database (DATABASE_URL or the embedded one) — never a lab's. */
export async function getMainDb(): Promise<Db> {
  if (store.dbRef) return store.dbRef;
  if (!store.initPromise) {
    const url = process.env.DATABASE_URL;
    store.initPromise = (url ? initPg(url) : initPglite()).then((db) => {
      store.dbRef = db;
      return db;
    });
  }
  return store.initPromise;
}

/**
 * The database this request works on: for a lab code, the lab's own database or its own
 * section of the site's (see ./lab.ts); otherwise the site's.
 */
export async function getDb(): Promise<Db> {
  const { labTarget, labDbFor } = await import("./lab");
  const t = await labTarget();
  return t ? labDbFor(t) : getMainDb();
}

/** Convenience: run a query on the site's own database (the lab codes live there). */
export async function mainQuery<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await (await getMainDb()).query<T>(sql, params)).rows;
}

/** Convenience: run a query and return rows. */
export async function query<T = any>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const db = await getDb();
  const r = await db.query<T>(sql, params);
  return r.rows;
}

/** Convenience: first row or null. */
export async function queryOne<T = any>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
