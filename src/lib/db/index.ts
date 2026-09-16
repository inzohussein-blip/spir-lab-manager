import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Data-source layer for the lab app. One interface, two interchangeable
 * backends (same pattern as Spir-Margin so a shared hosted DB just works):
 *
 *   • Embedded Postgres (PGlite/WASM) — default. Applies this repo's SQL
 *     migrations + seed in-process, persisted to a local data dir. Zero setup.
 *
 *   • Hosted Postgres (node-postgres) — used when DATABASE_URL is set (the
 *     shared Supabase instance on Vercel). Migrations assumed already applied.
 */

export interface Db {
  query<T = any>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; affectedRows?: number }>;
}

const DATA_DIR =
  process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".pglite-data");
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const SEED_FILE = path.join(process.cwd(), "supabase", "seed.sql");

// date/time OIDs -> keep as text (matches PostgREST + how pages render them).
const DATE_OIDS = [1082, 1083, 1114, 1184, 1266];

// A single shared connection lives on globalThis, not in module scope: Next.js
// can load this module more than once (RSC + server-action bundles, dev HMR),
// and a per-module handle would open a second PGlite instance against the same
// data dir, making writes on one invisible to reads on the other.
interface DbSingleton {
  dbRef: Db | null;
  initPromise: Promise<Db> | null;
}
const g = globalThis as unknown as { __labDb?: DbSingleton };
const store: DbSingleton = (g.__labDb ??= { dbRef: null, initPromise: null });

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
  const fresh = !fs.existsSync(DATA_DIR);
  const pg = await PGlite.create(DATA_DIR, {
    extensions: { pgcrypto },
    parsers: Object.fromEntries(DATE_OIDS.map((oid) => [oid, (v: string) => v])),
  });

  if (fresh) {
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

  return {
    async query(sql, params) {
      const r = await pg.query(sql, params as any[]);
      return { rows: r.rows as any[], affectedRows: r.affectedRows };
    },
  };
}

export async function getDb(): Promise<Db> {
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
