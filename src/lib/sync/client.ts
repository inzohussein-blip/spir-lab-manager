"use client";

/**
 * Syncing a lab's devices through the lab's own database (see protocol.ts).
 *
 * - The stations keep reading and writing this device's copy as before (lib/local/kv); nothing
 *   waits for the network. Sync runs in the background: every 30 seconds, soon after a change,
 *   and when the connection comes back.
 * - What this device changed is noted record by record in an outbox (its own IndexedDB database,
 *   so it survives closing the browser and works with several tabs open), then sent.
 * - What the other devices changed is received and written in; when both changed the same
 *   record, the later change wins.
 * - Linking a device that already has data to a database that already has data asks first:
 *   take the lab's data (this device's copy is kept aside and can be restored), or merge both.
 */
import { kvReady, kvGet, kvApply, kvSyncedEntries as kvAllSynced, isSyncedKey as kvIsSynced, onKvChange, KV_REMOTE_EVENT, type KvOrigin } from "@/lib/local/kv";
import { licenseIdentity, licenseProof, licenseSync, refreshLicense } from "@/lib/license/client";
import { PULL_LIMIT, PUSH_LIMIT, PULL_BYTES, PUSH_BYTES, COMPANY_SYNC_KEY, companySyncOn, sharedStation, type SupabaseConfig, type SyncRow } from "./protocol";

// Stations this computer keeps to itself («محطة المزامنة ← الإعدادات») are neither sent nor received.
const isSyncedKey = (k: string) => kvIsSynced(k) && sharedStation(k);
const kvSyncedEntries = () => kvAllSynced().filter(([k]) => sharedStation(k));
import { SupaError, supaProbe, supaPull, supaPush, supaRefresh, supaSignIn, type SupaSession } from "./supabase";

// ── Local bookkeeping (IndexedDB "lab-sync": outbox + meta) ──────────────────
const DB = "lab-sync";
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("outbox")) r.result.createObjectStore("outbox");
      if (!r.result.objectStoreNames.contains("meta")) r.result.createObjectStore("meta");
    };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); res(r.result); };
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}
async function tx<T>(store: "outbox" | "meta", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const d = await db();
  return new Promise<T>((res, rej) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r ? r.result : (undefined as T));
    t.onerror = t.onabort = () => rej(t.error);
  });
}
const metaGet = <T,>(k: string) => tx<T | undefined>("meta", "readonly", (s) => s.get(k) as IDBRequest<T | undefined>);
const metaSet = (k: string, v: unknown) => tx("meta", "readwrite", (s) => { s.put(v, k); });
const metaDel = (k: string) => tx("meta", "readwrite", (s) => { s.delete(k); });

interface OutEntry { coll: string; id: string; mtime: number }
const okey = (coll: string, id: string) => `${coll}\n${id}`;
const outboxAll = () => tx<OutEntry[]>("outbox", "readonly", (s) => s.getAll() as IDBRequest<OutEntry[]>);
const outboxClear = () => tx("outbox", "readwrite", (s) => { s.clear(); });
/** Remove sent entries — unless changed again meanwhile (a newer mtime stays to be sent). */
async function outboxDone(done: OutEntry[]) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction("outbox", "readwrite");
    const s = t.objectStore("outbox");
    for (const e of done) {
      const r = s.get(okey(e.coll, e.id));
      r.onsuccess = () => { if ((r.result as OutEntry | undefined)?.mtime === e.mtime) s.delete(okey(e.coll, e.id)); };
    }
    t.oncomplete = () => res();
    t.onerror = t.onabort = () => rej(t.error);
  });
}
async function outboxPut(entries: OutEntry[]) {
  if (!entries.length) return;
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction("outbox", "readwrite");
    const s = t.objectStore("outbox");
    for (const e of entries) s.put(e, okey(e.coll, e.id));
    t.oncomplete = () => res();
    t.onerror = t.onabort = () => rej(t.error);
  });
}

// ── The link: which database, and this device's place in it ─────────────────
type Link =
  | { kind: "supabase"; cfg: SupabaseConfig; source: "local" | "code" }
  | { kind: "postgres"; host: string; source: "code" }
  | { kind: "company"; source: "company" };
export type LinkInfo = { kind: Link["kind"]; where: string; source: Link["source"]; email?: string };
interface State { link: string; node: string; cursor: number; joined: boolean; lastSync?: number; catchUpAt?: number; place?: string }

const LOCAL_KEY = "local";   // Supabase details saved on this device
const STATE_KEY = "state";
const SESSION_KEY = "session";
const SNAPSHOT_KEY = "snapshot";

let localCfg: SupabaseConfig | null = null;
function currentLink(): Link | null {
  const s = licenseSync();
  if (s) return s.kind === "postgres" ? { kind: "postgres", host: s.host, source: "code" } : { kind: "supabase", cfg: s, source: "code" };
  if (localCfg) return { kind: "supabase", cfg: localCfg, source: "local" };
  return companySyncOn() ? { kind: "company", source: "company" } : null;
}
const fingerprint = (l: Link) => l.kind === "company" ? "company" : l.kind === "postgres" ? `pg|${l.host}` : `sb|${l.cfg.url}|${l.cfg.email}`;
const info = (l: Link): LinkInfo => l.kind === "company" ? { kind: "company", where: "مكان المختبر على الخادم", source: "company" } : l.kind === "postgres"
  ? { kind: "postgres", where: l.host, source: l.source }
  : { kind: "supabase", where: (() => { try { return new URL(l.cfg.url).host; } catch { return l.cfg.url; } })(), source: l.source, email: l.cfg.email };
const newNode = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// ── Talking to the database ──────────────────────────────────────────────────
export type SyncErrorCode = "auth" | "no_table" | "unreachable" | "db" | "no_code" | "offline" | "private_host" | "bad_url" | "owner_set" | "bad_config" | "no_secret" | "tls" | "needs_db" | "bad_hub_key";
class SyncError extends Error { constructor(public code: SyncErrorCode) { super(code); } }

interface Adapter {
  pull(since: number, node: string): Promise<SyncRow[]>;
  push(rows: SyncRow[], node: string): Promise<number>;
  probe(): Promise<{ records: number; rev: number; place?: string }>;
}
function supabaseAdapter(cfg: SupabaseConfig): Adapter {
  const fp = `sb|${cfg.url}|${cfg.email}`;
  let session: SupaSession | null = null;
  const signIn = async () => { session = await supaSignIn(cfg); await metaSet(SESSION_KEY, { fp, ...session }); return session; };
  const ensure = async (): Promise<SupaSession> => {
    if (!session) {
      const saved = await metaGet<SupaSession & { fp: string }>(SESSION_KEY);
      if (saved?.fp === fp) session = saved;
    }
    if (session && session.exp - Date.now() > 60_000) return session;
    if (session?.refresh) {
      try { session = await supaRefresh(cfg, session.refresh); await metaSet(SESSION_KEY, { fp, ...session }); return session; }
      catch (e) { if (e instanceof SupaError && e.code === "unreachable") throw e; }
    }
    return signIn();
  };
  const run = async <T,>(fn: (s: SupaSession) => Promise<T>): Promise<T> => {
    try { return await fn(await ensure()); }
    catch (e) {
      if (e instanceof SupaError && e.code === "auth") {
        try { return await fn(await signIn()); } catch (e2) { throw e2 instanceof SupaError ? new SyncError(e2.code) : e2; }
      }
      throw e instanceof SupaError ? new SyncError(e.code) : e;
    }
  };
  return {
    pull: (since, node) => run((s) => supaPull(cfg, s, since, node)),
    push: (rows, node) => run((s) => supaPush(cfg, s, rows, node)),
    probe: () => run((s) => supaProbe(cfg, s)),
  };
}
async function server(op: string, body: Record<string, unknown> = {}, url = "/api/labsync"): Promise<Record<string, unknown>> {
  // The signed license goes along: the server serves only the lab it names, on this device.
  // On the lab's local network hub, its key instead (a local install has no lab codes).
  const hub = url === "/api/company-sync" ? hubKey() : "";
  const who = hub ? { hub } : await licenseProof();
  if (!who) throw new SyncError("no_code");
  let r: Response;
  try {
    r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ op, ...who, ...body }) });
  } catch { throw new SyncError("unreachable"); }
  const d = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!d) throw new SyncError("unreachable");
  if (!d.ok) {
    const e = String(d.error ?? "db");
    throw new SyncError((["auth", "no_table", "unreachable", "private_host", "bad_url", "owner_set", "bad_config", "no_secret", "tls", "needs_db", "bad_hub_key"].includes(e) ? e : e === "no_db" || e === "db" ? "db" : "no_code") as SyncErrorCode);
  }
  return d;
}
const serverAdapter: Adapter = {
  pull: async (since, node) => ((await server("pull", { since, node })).rows as SyncRow[]) ?? [],
  push: async (rows, node) => Number((await server("push", { rows, node })).written) || 0,
  probe: async () => { const d = await server("probe"); return { records: Number(d.records) || 0, rev: Number(d.rev) || 0 }; },
};
/** The key of the lab's local network hub, kept on this computer («محطة المزامنة»). */
export const HUB_KEY = "lab-hub-key";
export function hubKey(): string { try { return localStorage.getItem(HUB_KEY) ?? ""; } catch { return ""; } }
export async function setHubKey(k: string) {
  try { if (k) localStorage.setItem(HUB_KEY, k); else localStorage.removeItem(HUB_KEY); } catch { /* ignore */ }
  await metaDel(STATE_KEY); await outboxClear(); state = null; base.clear();
  await syncNow();
}

/** The lab's own place, through the site's server (or its local network hub). */
const co = (op: string, body: Record<string, unknown> = {}) => server(op, body, "/api/company-sync");
const companyAdapter: Adapter = {
  pull: async (since, node) => ((await co("pull", { since, node })).rows as SyncRow[]) ?? [],
  push: async (rows, node) => Number((await co("push", { rows, node })).written) || 0,
  probe: async () => { const d = await co("probe"); return { records: Number(d.records) || 0, rev: Number(d.rev) || 0, place: String(d.place ?? "") }; },
};
const adapterFor = (l: Link): Adapter => (l.kind === "company" ? companyAdapter : l.kind === "postgres" ? serverAdapter : supabaseAdapter(l.cfg));

// ── Text only: images stay on the device ─────────────────────────────────────
// Only text travels to the lab's database. An image or file kept inside a record as a data URL
// (the lab's logo in the station settings) stays on the device that has it: it is left out of
// what is sent, and kept when that record arrives changed from another device.
const isMedia = (v: unknown) => typeof v === "string" && v.startsWith("data:");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function textOnly(x: unknown): unknown {
  if (Array.isArray(x)) return x.filter((v) => !isMedia(v)).map(textOnly);
  if (isObj(x)) return Object.fromEntries(Object.entries(x).filter(([, v]) => !isMedia(v)).map(([k, v]) => [k, textOnly(v)]));
  return x;
}
/** A record from another device, with this device's own images put back in. */
function keepMedia(remote: unknown, local: unknown): unknown {
  if (!isObj(remote) || !isObj(local)) return remote;
  const out: Record<string, unknown> = { ...remote };
  for (const [k, v] of Object.entries(local)) {
    if (isMedia(v)) out[k] = v; // an image here stays until this device changes it
    else if (isObj(v) && isObj(remote[k])) out[k] = keepMedia(remote[k], v);
  }
  return out;
}

// ── Records of a stored value ────────────────────────────────────────────────
type Records = Map<string, string>;
/** A list of records with ids → id → its JSON; anything else is one record "_". */
function recordsOf(v: string | null): Records {
  const m: Records = new Map();
  if (v == null) return m;
  try {
    const x = JSON.parse(v) as unknown;
    if (Array.isArray(x) && x.every((e) => e && typeof e === "object" && typeof (e as { id?: unknown }).id === "string")) {
      for (const e of x as { id: string }[]) m.set(e.id, JSON.stringify(textOnly(e)));
      return m;
    }
    // One value: compared without its images (changing only the logo sends nothing).
    m.set("_", isObj(x) || Array.isArray(x) ? JSON.stringify(textOnly(x)) : v);
    return m;
  } catch { /* not JSON: one value */ }
  m.set("_", v);
  return m;
}
const base = new Map<string, Records>();
function rebuildBase() {
  base.clear();
  for (const [k, v] of kvSyncedEntries()) base.set(k, recordsOf(v));
}

// ── Status (for the settings panel and the banners) ──────────────────────────
export type SyncStatus = {
  state: "off" | "unsupported" | "needs_join" | "syncing" | "ok" | "error";
  link: LinkInfo | null;
  lastSync?: number;
  pending: number;
  error?: SyncErrorCode;
  /** When joining: how many records the lab's database already holds. */
  remoteRecords?: number;
  hasSnapshot?: boolean;
};
export const SYNC_EVENT = "lab-sync-status";
let status: SyncStatus = { state: "off", link: null, pending: 0 };
function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  try { window.dispatchEvent(new Event(SYNC_EVENT)); } catch { /* ignore */ }
}
export const syncStatus = () => status;

// ── The clock: «the later change wins» compares corrected times ──────────────
// A computer whose clock is wrong (ahead, it would always win; behind, always lose) is corrected
// by the site's clock, measured when online; offline, the last correction is used.
const CLOCK_KEY = "clock";
let offset = 0; // server − this device, ms
let clockAt = 0;
const now = () => Date.now() + offset;
async function measureClock() {
  try {
    const t0 = Date.now();
    const r = await fetch("/api/time", { cache: "no-store" });
    const d = (await r.json()) as { now?: unknown };
    const t1 = Date.now();
    if (!r.ok || typeof d.now !== "number" || t1 - t0 > 5000) return;
    offset = Math.round(d.now + (t1 - t0) / 2 - t1);
    clockAt = t1;
    await metaSet(CLOCK_KEY, { offset, at: t1 });
  } catch { /* offline or site down: keep the last correction */ }
}
/** How far this device's clock is from the site's (for the settings panel). */
export const clockOffset = () => offset;

// ── Telling the code manager how the sync goes (devices activated with a lab code) ──
let reported = { at: 0, sig: "" };
async function reportStatus() {
  const who = await licenseIdentity().catch(() => null);
  if (!who) return;
  const sig = `${status.state}|${status.error ?? ""}|${status.pending > 0}`;
  if (sig === reported.sig && Date.now() - reported.at < 30 * 60_000) return;
  reported = { at: Date.now(), sig };
  try {
    await fetch("/api/license/sync-status", {
      method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ ...who, last: status.lastSync ?? 0, pending: status.pending, error: status.state === "error" || status.state === "needs_join" ? status.error ?? status.state : "" }),
    });
  } catch { /* told next time */ }
}

// ── Tracking this device's changes ───────────────────────────────────────────
let state: State | null = null;
let queue: OutEntry[] = [];
let flushing: Promise<void> | null = null;
function flushQueue(): Promise<void> {
  flushing ??= (async () => {
    while (queue.length) { const q = queue; queue = []; await outboxPut(q).catch(() => { queue.unshift(...q); }); }
  })().finally(() => { flushing = null; });
  return flushing;
}
function onChange(k: string, prev: string | null, next: string | null, origin: KvOrigin) {
  if (!state?.joined || !isSyncedKey(k)) return;
  const neu = recordsOf(next);
  if (origin === "external") { base.set(k, neu); return; }
  const old = base.get(k) ?? recordsOf(prev);
  const t = now();
  const changed: OutEntry[] = [];
  for (const [id, j] of neu) if (old.get(id) !== j) changed.push({ coll: k, id, mtime: t });
  for (const id of old.keys()) if (!neu.has(id)) changed.push({ coll: k, id, mtime: t });
  base.set(k, neu);
  if (!changed.length) return;
  queue.push(...changed);
  setStatus({ pending: status.pending + changed.length });
  void flushQueue();
  soon();
}

// ── One round: receive, then send ────────────────────────────────────────────
const OVERLAP = 200; // re-read the last revs now and then (a write committed late is never missed)
const CATCH_UP_MS = 15 * 60_000;

function applyRows(coll: string, rows: SyncRow[], pending: Map<string, OutEntry>, done: OutEntry[]): boolean {
  const cur = kvGet(coll);
  let whole: SyncRow | null = null;
  const recs: SyncRow[] = [];
  for (const r of rows) {
    const p = pending.get(okey(coll, r.id));
    if (p && p.mtime > r.mtime) continue; // this device's own later change wins; it is sent next
    if (p) { done.push(p); pending.delete(okey(coll, r.id)); }
    if (r.id === "_") whole = r; else recs.push(r);
  }
  let next = cur;
  if (whole) {
    const d = whole.data as { __raw?: unknown } | null;
    let mine: unknown = null;
    try { mine = cur == null ? null : JSON.parse(cur); } catch { /* not JSON */ }
    next = whole.deleted ? null : d && typeof d === "object" && typeof d.__raw === "string" ? d.__raw : JSON.stringify(keepMedia(whole.data, mine));
  }
  if (recs.length) {
    let arr: { id?: string }[] = [];
    try { const x = next == null ? [] : JSON.parse(next); if (Array.isArray(x)) arr = x; } catch { /* start a list */ }
    for (const r of recs) {
      const i = arr.findIndex((e) => e && e.id === r.id);
      if (r.deleted) { if (i >= 0) arr.splice(i, 1); }
      else if (i >= 0) arr[i] = keepMedia(r.data, arr[i]) as { id: string };
      else arr.splice(Math.min(Math.max(0, r.ord), arr.length), 0, r.data as { id: string });
    }
    next = JSON.stringify(arr);
  }
  if (next === cur) return false;
  kvApply(coll, next);
  return true;
}

async function pullInto(ad: Adapter, st: State): Promise<number> {
  const pending = new Map((await outboxAll()).map((e) => [okey(e.coll, e.id), e]));
  const catchUp = !st.catchUpAt || Date.now() - st.catchUpAt > CATCH_UP_MS;
  let since = catchUp ? Math.max(0, st.cursor - OVERLAP) : st.cursor;
  let applied = 0;
  for (;;) {
    const rows = await ad.pull(since, st.node);
    if (!rows.length) break;
    const done: OutEntry[] = [];
    const byColl = new Map<string, SyncRow[]>();
    for (const r of rows) if (isSyncedKey(r.coll)) (byColl.get(r.coll) ?? byColl.set(r.coll, []).get(r.coll)!).push(r);
    for (const [coll, rs] of byColl) if (applyRows(coll, rs, pending, done)) applied += rs.length;
    if (done.length) await outboxDone(done);
    since = Math.max(since, ...rows.map((r) => Number(r.rev) || 0));
    st.cursor = Math.max(st.cursor, since);
    await metaSet(STATE_KEY, st);
    // A page may come back shorter than the limit when its records are large: ask again until
    // nothing is left, unless the page was clearly small.
    if (rows.length < PULL_LIMIT && JSON.stringify(rows).length < PULL_BYTES / 2) break;
  }
  if (catchUp) { st.catchUpAt = Date.now(); await metaSet(STATE_KEY, st); }
  if (applied) { try { window.dispatchEvent(new CustomEvent(KV_REMOTE_EVENT, { detail: applied })); } catch { /* ignore */ } }
  return applied;
}

/** The record as this device holds it now (or deleted). */
function rowsFor(entries: OutEntry[]): SyncRow[] {
  const parsed = new Map<string, unknown>();
  const valueOf = (coll: string) => {
    // A value that is not JSON travels as { __raw } and is written back as it was.
    if (!parsed.has(coll)) { const v = kvGet(coll); try { parsed.set(coll, v == null ? null : JSON.parse(v)); } catch { parsed.set(coll, { __raw: v }); } }
    return parsed.get(coll);
  };
  return entries.map((e) => {
    const v = valueOf(e.coll);
    if (e.id === "_") return { coll: e.coll, id: "_", data: textOnly(v ?? null), mtime: e.mtime, deleted: v == null, ord: 0 };
    const arr = Array.isArray(v) ? (v as { id?: string }[]) : [];
    const i = arr.findIndex((x) => x && x.id === e.id);
    return i < 0 ? { coll: e.coll, id: e.id, data: null, mtime: e.mtime, deleted: true, ord: 0 } : { coll: e.coll, id: e.id, data: textOnly(arr[i]), mtime: e.mtime, deleted: false, ord: i };
  });
}
async function pushFrom(ad: Adapter, st: State) {
  await flushQueue();
  for (;;) {
    const all = (await outboxAll()).sort((a, b) => a.mtime - b.mtime);
    setStatus({ pending: all.length });
    if (!all.length) return;
    // A batch stays under ~1.5 MB (the site takes about 4 MB per request).
    const rows = rowsFor(all.slice(0, PUSH_LIMIT));
    let size = 0, n = 0;
    while (n < rows.length) { size += JSON.stringify(rows[n]).length; if (n > 0 && size > PUSH_BYTES) break; n++; }
    const batch = all.slice(0, n);
    await ad.push(rows.slice(0, n), st.node);
    await outboxDone(batch);
    if (all.length <= n) { setStatus({ pending: (await outboxAll()).length }); return; }
  }
}

let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
function soon(ms = 2000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, ms);
}

/** Load the link and this device's place in it; a new link starts unjoined with a new node. */
async function loadState(link: Link | null): Promise<State | null> {
  if (!link) {
    // Unlinked (here or by the owner): a later link starts over, asking how to join again.
    if (state || (await metaGet<State>(STATE_KEY))) { await metaDel(STATE_KEY); await metaDel(SESSION_KEY); await outboxClear(); base.clear(); }
    state = null;
    return null;
  }
  const fp = fingerprint(link);
  let st = (await metaGet<State>(STATE_KEY)) ?? null;
  if (!st || st.link !== fp) {
    st = { link: fp, node: newNode(), cursor: 0, joined: false };
    await outboxClear();
    await metaSet(STATE_KEY, st);
  }
  state = st;
  return st;
}

/** One round now (also run on a timer). Several tabs: one does it at a time. */
export function syncNow(): Promise<void> {
  running ??= (async () => {
    const work = async () => {
      const link = currentLink();
      const st = await loadState(link);
      if (!link || !st) { setStatus({ state: "off", link: null, pending: 0, error: undefined }); return; }
      const ad = adapterFor(link);
      setStatus({ link: info(link), hasSnapshot: !!(await metaGet(SNAPSHOT_KEY)) });
      if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus({ state: st.joined ? "ok" : "needs_join", error: "offline" }); return; }
      try {
        let probed: Awaited<ReturnType<Adapter["probe"]>> | null = null;
        if (link.kind === "company") {
          // The lab's place moved (it linked its own database) or was emptied (a temporary
          // store started over): join again, so this device's records reach it.
          probed = await ad.probe();
          if (st.joined && ((st.place && probed.place !== st.place) || probed.rev < st.cursor)) st.joined = false;
          st.place = probed.place;
        }
        if (!st.joined) {
          const { records } = probed ?? (await ad.probe());
          // An empty lab database: this device's data becomes the lab's, without asking.
          if (records === 0) await joinWith(ad, st, "upload");
          // The lab's own computers merge without asking (nothing is removed on either side).
          else if (link.kind === "company") await joinWith(ad, st, "merge");
          else { setStatus({ state: "needs_join", remoteRecords: records, error: undefined }); return; }
        }
        setStatus({ state: "syncing", error: undefined });
        await pullInto(ad, st);
        await pushFrom(ad, st);
        st.lastSync = Date.now();
        await metaSet(STATE_KEY, st);
        setStatus({ state: "ok", lastSync: st.lastSync, error: undefined });
      } catch (e) {
        setStatus({ state: st.joined ? "error" : "needs_join", error: e instanceof SyncError ? e.code : "db" });
      }
    };
    const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    if (locks) await locks.request("lab-sync", { ifAvailable: true }, async (lock) => { if (lock) await work(); });
    else await work();
    if (status.link) void reportStatus();
  })().finally(() => { running = null; });
  return running;
}

// ── Joining: how this device's data meets the lab's ───────────────────────────
export type JoinMode = "upload" | "replace" | "merge";
/** A record's identity apart from its ids: built-in tests by their code, anything else by its content
 *  (so the lists every device creates the same way — tests, QC levels, shifts — are not doubled). */
function sameness(rec: unknown): string {
  const r = rec as { code?: unknown } | null;
  if (r && typeof r === "object" && typeof r.code === "string" && r.code) return `code:${r.code}`;
  const strip = (x: unknown): unknown => Array.isArray(x) ? x.map(strip)
    : x && typeof x === "object" ? Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([k]) => k !== "id").sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, strip(v)]))
    : x;
  return `data:${JSON.stringify(strip(rec))}`;
}

async function joinWith(ad: Adapter, st: State, mode: JoinMode) {
  await outboxClear();
  if (mode === "upload") {
    // An empty lab database: every record here is sent.
    const seed: OutEntry[] = [];
    for (const [k, v] of kvSyncedEntries()) for (const id of recordsOf(v).keys()) seed.push({ coll: k, id, mtime: 1 });
    await outboxPut(seed);
    st.cursor = 0;
  } else {
    // Download everything first: nothing on this device changes if the download stops half-way.
    const rows: SyncRow[] = [];
    let since = 0;
    for (;;) {
      const page = await ad.pull(since, "");
      rows.push(...page);
      if (page.length) since = Math.max(since, ...page.map((r) => Number(r.rev) || 0));
      if (!page.length || (page.length < PULL_LIMIT && JSON.stringify(page).length < PULL_BYTES / 2)) break;
    }
    const byColl = new Map<string, SyncRow[]>();
    for (const r of rows.sort((a, b) => (a.rev ?? 0) - (b.rev ?? 0))) if (isSyncedKey(r.coll)) (byColl.get(r.coll) ?? byColl.set(r.coll, []).get(r.coll)!).push(r);
    if (mode === "replace") {
      await metaSet(SNAPSHOT_KEY, { at: Date.now(), entries: kvSyncedEntries() });
      for (const [k] of kvSyncedEntries()) if (!byColl.has(k)) kvApply(k, null);
      for (const [coll, rs] of byColl) { kvApply(coll, null); applyRows(coll, rs, new Map(), []); }
    } else {
      // Merge: the lab's records come in; this device's own records are kept and sent — except
      // those the lab already has under another id (the same built-in test, the same default shift…).
      const seed: OutEntry[] = [];
      for (const [k, v] of kvSyncedEntries()) {
        const remote = byColl.get(k) ?? [];
        const live = remote.filter((r) => !r.deleted);
        const local = recordsOf(v);
        if (local.has("_")) { if (!remote.some((r) => r.id === "_")) seed.push({ coll: k, id: "_", mtime: 1 }); continue; }
        const ids = new Set(remote.map((r) => r.id));
        const same = new Set(live.map((r) => sameness(r.data)));
        let arr: { id: string }[] = [];
        try { arr = JSON.parse(v) as { id: string }[]; } catch { /* keep none */ }
        const kept = arr.filter((rec) => ids.has(rec.id) || !same.has(sameness(rec)));
        for (const rec of kept) if (!ids.has(rec.id)) seed.push({ coll: k, id: rec.id, mtime: 1 });
        if (kept.length !== arr.length) kvApply(k, JSON.stringify(kept));
      }
      for (const [coll, rs] of byColl) applyRows(coll, rs, new Map(), []);
      await outboxPut(seed);
    }
    st.cursor = since;
    try { window.dispatchEvent(new CustomEvent(KV_REMOTE_EVENT, { detail: rows.length })); } catch { /* ignore */ }
  }
  st.joined = true;
  st.catchUpAt = Date.now();
  await metaSet(STATE_KEY, st);
  rebuildBase();
}

/** The person's choice when the lab's database already has data. */
export async function join(mode: JoinMode): Promise<{ ok: boolean; error?: SyncErrorCode }> {
  const link = currentLink();
  const st = await loadState(link);
  if (!link || !st) return { ok: false, error: "db" };
  try {
    setStatus({ state: "syncing", error: undefined });
    await joinWith(adapterFor(link), st, mode);
  } catch (e) {
    setStatus({ state: "needs_join", error: e instanceof SyncError ? e.code : "db" });
    return { ok: false, error: e instanceof SyncError ? e.code : "db" };
  }
  await syncNow();
  return { ok: true };
}

/** Put back this device's data as it was before «use the lab's data», and unlink. */
export async function restoreSnapshot(): Promise<boolean> {
  const snap = await metaGet<{ at: number; entries: [string, string][] }>(SNAPSHOT_KEY);
  if (!snap) return false;
  await unlink();
  for (const [k] of kvSyncedEntries()) kvApply(k, null);
  for (const [k, v] of snap.entries) kvApply(k, v);
  await metaDel(SNAPSHOT_KEY);
  try { window.dispatchEvent(new CustomEvent(KV_REMOTE_EVENT, { detail: snap.entries.length })); } catch { /* ignore */ }
  setStatus({ hasSnapshot: false });
  return true;
}

// ── Linking from the station's settings ──────────────────────────────────────
function supaCode(e: unknown): SyncErrorCode { return e instanceof SupaError ? e.code : e instanceof SyncError ? e.code : "db"; }

/** Supabase, kept on this device: signs in and checks the table before saving. */
export async function linkSupabase(cfg: SupabaseConfig): Promise<{ ok: boolean; error?: SyncErrorCode; records?: number }> {
  try {
    const s = await supaSignIn(cfg);
    const { records } = await supaProbe(cfg, s);
    await metaSet(LOCAL_KEY, cfg);
    localCfg = cfg;
    void syncNow();
    return { ok: true, records };
  } catch (e) { return { ok: false, error: supaCode(e) }; }
}
/** PostgreSQL: the connection string goes to the server (kept sealed there, linked to this code). */
export async function linkPostgres(conn: string): Promise<{ ok: boolean; error?: SyncErrorCode; records?: number }> {
  try {
    const d = await server("config", { config: { kind: "postgres", conn } });
    await refreshLicense(true);
    void syncNow();
    return { ok: true, records: Number(d.records) || 0 };
  } catch (e) { return { ok: false, error: e instanceof SyncError ? e.code : "db" }; }
}
/** Stop syncing this device (its data stays). A link set from the code manager stays until the owner removes it. */
export async function unlink(): Promise<{ ok: boolean; error?: SyncErrorCode }> {
  const link = currentLink();
  if (link?.source === "code" && link.kind === "postgres") {
    try { await server("config", { config: null }); await refreshLicense(true); }
    catch (e) { return { ok: false, error: e instanceof SyncError ? e.code : "db" }; }
  }
  await metaDel(LOCAL_KEY);
  localCfg = null;
  await metaDel(STATE_KEY);
  await metaDel(SESSION_KEY);
  await outboxClear();
  state = null;
  base.clear();
  await syncNow();
  return { ok: true };
}
/** Ask the server for this code's link again (after the owner changed it). */
export async function refreshLink() {
  await refreshLicense(true);
  await syncNow();
}

/** «محطة المزامنة»: switch this computer's automatic sync with the lab's computers on or off
 *  (off: its data stays; switched on again later, it merges again). */
export async function setCompanySync(on: boolean): Promise<void> {
  try { if (on) localStorage.setItem(COMPANY_SYNC_KEY, "1"); else localStorage.removeItem(COMPANY_SYNC_KEY); } catch { /* ignore */ }
  if (!on) {
    await metaDel(STATE_KEY);
    await outboxClear();
    state = null;
    base.clear();
  }
  if (!started) { await startSync(); return; }
  await syncNow();
}

// ── Start (once per page, after the station data is loaded) ──────────────────
let started = false;
export async function startSync(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!(await kvReady()) || typeof indexedDB === "undefined") { setStatus({ state: "unsupported" }); return; }
  try { localCfg = (await metaGet<SupabaseConfig>(LOCAL_KEY)) ?? null; } catch { setStatus({ state: "unsupported" }); return; }
  const clock = await metaGet<{ offset: number; at: number }>(CLOCK_KEY).catch(() => undefined);
  if (clock) { offset = clock.offset; clockAt = clock.at; }
  void measureClock();
  const link = currentLink();
  const st = await loadState(link).catch(() => null);
  if (st?.joined) rebuildBase();
  onKvChange(onChange);
  window.addEventListener("online", () => soon(500));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") soon(500); });
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - clockAt > 3600_000) void measureClock();
    void syncNow();
  }, 30_000);
  // The code manager may have linked (or changed) this lab's database: ask now and then.
  void refreshLicense(false, 30 * 60_000).finally(() => { void syncNow(); });
  if (!link) void syncNow();
}
