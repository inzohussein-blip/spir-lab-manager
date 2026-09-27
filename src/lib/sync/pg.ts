import "server-only";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SCHEMA_SQL, PULL_LIMIT, PUSH_LIMIT, type SyncRow } from "./protocol";

/**
 * A lab's own PostgreSQL, reached from this server with the connection string the owner (or the
 * lab) entered. Each lab gets a small pool of its own; the table and write function are created
 * on first use.
 */

type Pool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};
const g = globalThis as unknown as { __labPools?: Map<string, { pool: Promise<Pool>; ready?: Promise<void> }> };
const pools = (g.__labPools ??= new Map());

export class LabDbError extends Error {
  constructor(public code: "bad_url" | "private_host" | "unreachable" | "auth" | "tls" | "db", message: string) { super(message); }
}

/** Private, loopback and link-local addresses are refused (this server is not a way into its own
 *  network). LAB_DB_ALLOW_PRIVATE=1 lifts it — for a self-hosted setup and the tests. */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return m ? privateAddress(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
export async function checkHost(host: string) {
  if (process.env.LAB_DB_ALLOW_PRIVATE === "1") return;
  let addrs: string[];
  try { addrs = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address); }
  catch { throw new LabDbError("unreachable", "host not found"); }
  if (!addrs.length || addrs.some(privateAddress)) throw new LabDbError("private_host", "private address");
}

export function sslFor(u: URL): false | { rejectUnauthorized: boolean } {
  const mode = u.searchParams.get("sslmode");
  if (mode === "disable") return false;
  return { rejectUnauthorized: mode !== "no-verify" };
}

async function poolFor(conn: string): Promise<Pool> {
  let u: URL;
  try { u = new URL(conn); } catch { throw new LabDbError("bad_url", "bad url"); }
  if (!/^postgres(ql)?:$/.test(u.protocol) || !u.hostname) throw new LabDbError("bad_url", "bad url");
  await checkHost(u.hostname);
  const key = createHash("sha256").update(conn).digest("hex");
  let e = pools.get(key);
  if (!e) {
    const ssl = sslFor(u);
    ["sslmode", "uselibpqcompat", "channel_binding"].forEach((p) => u.searchParams.delete(p));
    e = {
      pool: import("pg").then(({ Pool }) => new Pool({
        connectionString: u.toString(), ssl, max: 2, idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 8_000, statement_timeout: 20_000, query_timeout: 25_000,
      }) as unknown as Pool),
    };
    pools.set(key, e);
  }
  const entry = e;
  const pool = await entry.pool;
  entry.ready ??= pool.query(SCHEMA_SQL).then(() => undefined).catch((err) => { entry.ready = undefined; throw err; });
  try { await entry.ready; } catch (err) { throw toLabError(err); }
  return pool;
}

export function toLabError(err: unknown): LabDbError {
  if (err instanceof LabDbError) return err;
  const e = err as { code?: string; message?: string };
  const msg = String(e?.message ?? "error").slice(0, 200);
  if (e?.code === "28P01" || e?.code === "28000" || /password authentication/i.test(msg)) return new LabDbError("auth", msg);
  if (/self[- ]signed|certificate|does not support SSL|SSL|TLS/i.test(msg)) return new LabDbError("tls", msg);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|EAI_AGAIN|ECONNRESET/i.test(msg) || e?.code?.startsWith?.("E")) return new LabDbError("unreachable", msg);
  return new LabDbError("db", msg);
}

/** Can this server open it (and create the table)? Also tells whether it already holds records. */
export async function probe(conn: string): Promise<{ records: number }> {
  try {
    const pool = await poolFor(conn);
    const r = await pool.query(`select count(*)::int as n from lab_sync_records where not deleted`);
    return { records: Number(r.rows[0]?.n ?? 0) };
  } catch (err) { throw toLabError(err); }
}

const clean = (r: SyncRow, node: string) => ({
  coll: String(r.coll).slice(0, 120), id: String(r.id).slice(0, 200), data: r.deleted ? null : (r.data ?? null),
  mtime: Math.max(0, Math.round(Number(r.mtime) || 0)), deleted: !!r.deleted, ord: Math.max(0, Math.min(1e9, Math.round(Number(r.ord) || 0))), node,
});

export async function push(conn: string, rows: SyncRow[], node: string): Promise<number> {
  const batch = rows.slice(0, PUSH_LIMIT).filter((r) => r && typeof r.coll === "string" && typeof r.id === "string").map((r) => clean(r, node));
  if (!batch.length) return 0;
  try {
    const pool = await poolFor(conn);
    const r = await pool.query(`select lab_sync_push($1::jsonb) as n`, [JSON.stringify(batch)]);
    return Number(r.rows[0]?.n ?? 0);
  } catch (err) { throw toLabError(err); }
}

/** Records changed after `since` by other devices (oldest first). */
export async function pull(conn: string, since: number, node: string, limit = PULL_LIMIT): Promise<SyncRow[]> {
  try {
    const pool = await poolFor(conn);
    const r = await pool.query(
      `select coll, id, data, mtime, deleted, ord, rev from lab_sync_records where rev > $1 and node <> $2 order by rev limit $3`,
      [Math.max(0, Math.floor(since)), node, Math.max(1, Math.min(PULL_LIMIT, limit))],
    );
    return r.rows.map((x) => ({
      coll: String(x.coll), id: String(x.id), data: x.data ?? null, mtime: Number(x.mtime), deleted: !!x.deleted, ord: Number(x.ord), rev: Number(x.rev),
    }));
  } catch (err) { throw toLabError(err); }
}

/** The highest rev so far (a device that replaces its data with the lab's starts from here). */
export async function lastRev(conn: string): Promise<number> {
  try {
    const pool = await poolFor(conn);
    const r = await pool.query(`select coalesce(max(rev), 0)::bigint as n from lab_sync_records`);
    return Number(r.rows[0]?.n ?? 0);
  } catch (err) { throw toLabError(err); }
}
