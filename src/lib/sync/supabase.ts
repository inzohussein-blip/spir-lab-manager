/**
 * A lab's Supabase project, over its REST API (no SDK: a few calls, and nothing extra to load
 * on the stations). Used by the stations to sync, and by the code manager to test a link.
 * Signs in as a user of the lab's project: the anon key alone reads nothing (see SUPABASE_SQL).
 */
import { PULL_LIMIT, type SupabaseConfig, type SyncRow } from "./protocol";

export class SupaError extends Error {
  constructor(public code: "auth" | "no_table" | "unreachable" | "db", message: string = code) { super(message); }
}
export interface SupaSession { access: string; refresh: string; exp: number }

const TIMEOUT = 20_000;
const base = (cfg: SupabaseConfig) => cfg.url.replace(/\/+$/, "");
const signal = () => (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(TIMEOUT) : undefined);

async function call(url: string, init: RequestInit): Promise<Response> {
  try { return await fetch(url, { ...init, signal: signal(), cache: "no-store" }); }
  catch { throw new SupaError("unreachable"); }
}
async function fail(r: Response): Promise<never> {
  const d = (await r.json().catch(() => ({}))) as { code?: string; message?: string; error?: string; msg?: string };
  const msg = String(d.message ?? d.msg ?? d.error ?? r.statusText).slice(0, 200);
  if (r.status === 401 || r.status === 403 || d.code === "42501" || d.code === "PGRST301" || d.code === "PGRST302") throw new SupaError("auth", msg);
  if (r.status === 404 || d.code === "PGRST202" || d.code === "PGRST205" || d.code === "42P01" || d.code === "42883") throw new SupaError("no_table", msg);
  if ([502, 503, 504].includes(r.status)) throw new SupaError("unreachable", msg);
  throw new SupaError("db", msg);
}

async function token(cfg: SupabaseConfig, grant: "password" | "refresh_token", body: Record<string, string>): Promise<SupaSession> {
  const r = await call(`${base(cfg)}/auth/v1/token?grant_type=${grant}`, {
    method: "POST", headers: { apikey: cfg.anonKey, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    if (r.status >= 400 && r.status < 500) throw new SupaError("auth", `sign-in ${r.status}`);
    throw new SupaError("unreachable", `sign-in ${r.status}`);
  }
  const d = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!d.access_token) throw new SupaError("auth", "no token");
  return { access: d.access_token, refresh: d.refresh_token ?? "", exp: Date.now() + Math.max(60, Number(d.expires_in) || 3600) * 1000 };
}
export const supaSignIn = (cfg: SupabaseConfig) => token(cfg, "password", { email: cfg.email, password: cfg.password });
export const supaRefresh = (cfg: SupabaseConfig, refresh: string) => token(cfg, "refresh_token", { refresh_token: refresh });

const headers = (cfg: SupabaseConfig, s: SupaSession, extra: Record<string, string> = {}) =>
  ({ apikey: cfg.anonKey, authorization: `Bearer ${s.access}`, "content-type": "application/json", ...extra });
const table = (cfg: SupabaseConfig) => `${base(cfg)}/rest/v1/lab_sync_records`;

/** Records changed after `since` by other devices (oldest first). */
export async function supaPull(cfg: SupabaseConfig, s: SupaSession, since: number, node: string, limit = PULL_LIMIT): Promise<SyncRow[]> {
  const q = new URLSearchParams({ select: "coll,id,data,mtime,deleted,ord,rev", rev: `gt.${Math.max(0, Math.floor(since))}`, node: `neq.${node}`, order: "rev.asc", limit: String(limit) });
  const r = await call(`${table(cfg)}?${q}`, { headers: headers(cfg, s) });
  if (!r.ok) await fail(r);
  const rows = (await r.json()) as SyncRow[];
  return rows.map((x) => ({ ...x, mtime: Number(x.mtime), rev: Number(x.rev), ord: Number(x.ord) }));
}

export async function supaPush(cfg: SupabaseConfig, s: SupaSession, rows: SyncRow[], node: string): Promise<number> {
  const batch = rows.map((r) => ({ coll: r.coll, id: r.id, data: r.deleted ? null : r.data ?? null, mtime: r.mtime, deleted: r.deleted, ord: r.ord, node }));
  const r = await call(`${base(cfg)}/rest/v1/rpc/lab_sync_push`, { method: "POST", headers: headers(cfg, s), body: JSON.stringify({ batch }) });
  if (!r.ok) await fail(r);
  return Number(await r.json().catch(() => 0)) || 0;
}

/** Is the table there (the SQL was run)? How many records does it hold, and the latest rev. */
export async function supaProbe(cfg: SupabaseConfig, s: SupaSession): Promise<{ records: number; rev: number }> {
  const r = await call(`${table(cfg)}?select=rev&deleted=is.false&limit=1`, { headers: headers(cfg, s, { prefer: "count=exact" }) });
  if (!r.ok) await fail(r);
  const records = Number((r.headers.get("content-range") ?? "").split("/")[1]) || 0;
  const r2 = await call(`${table(cfg)}?select=rev&order=rev.desc&limit=1`, { headers: headers(cfg, s) });
  if (!r2.ok) await fail(r2);
  const last = (await r2.json()) as { rev: number }[];
  return { records, rev: Number(last[0]?.rev ?? 0) };
}
