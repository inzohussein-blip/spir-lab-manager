"use client";

/**
 * Where the local stations keep their data: the browser's IndexedDB (hundreds of MB),
 * not localStorage (about 5 MB for the whole site, which a busy lab outgrows).
 *
 * The stores keep their simple synchronous calls: everything is loaded into memory once
 * (LocalDataGate waits for it before a station renders), reads come from memory, and every
 * write is saved to IndexedDB right away. Other open tabs get each write too.
 *
 * On the first open after the update, the station data found in localStorage is copied in
 * and then removed there. If IndexedDB cannot be used (some private windows), everything
 * stays on localStorage as before.
 *
 * Data found in localStorage later (an older saved copy of the app opened without internet
 * writes there) never replaces what IndexedDB holds: visits and patients entered in it are
 * added, anything else is dropped.
 */

const DB_NAME = "lab-local";
const STORE = "kv";
const PREFIXES = ["station.", "purchasing.", "training.", "qc.", "roster."];
/** Kept in localStorage: read by the inline script that sets the theme before the page paints. */
const isTheme = (k: string) => k.endsWith(".theme.v1");
const isData = (k: string) => PREFIXES.some((p) => k.startsWith(p)) && !isTheme(k);
/** Records a lab may enter in an older saved copy; merged in by id when both sides have them. */
const RECORDS = new Set(["station.visits.v1", "station.patients.v1"]);

/** What to keep for a key found in localStorage while IndexedDB already holds it. */
function merge(k: string, current: string, found: string): string {
  if (!RECORDS.has(k)) return current;
  try {
    const a = JSON.parse(current) as { id?: unknown }[], b = JSON.parse(found) as { id?: unknown }[];
    if (!Array.isArray(a) || !Array.isArray(b)) return current;
    const have = new Set(a.map((x) => x?.id));
    const extra = b.filter((x) => x && typeof x.id === "string" && !have.has(x.id));
    return extra.length ? JSON.stringify([...a, ...extra]) : current;
  } catch {
    return current;
  }
}

let mem: Map<string, string> | null = null; // null → not loaded (or no IndexedDB): use localStorage
let db: IDBDatabase | null = null;
let ready: Promise<boolean> | null = null;
let chan: BroadcastChannel | null = null;

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
}

/** Load the station data into memory (once per page). Resolves false when IndexedDB is unavailable. */
export function kvReady(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  ready ??= (async () => {
    try {
      if (typeof indexedDB === "undefined") return false;
      const d = await openDb();
      const tx = d.transaction(STORE, "readonly");
      const [keys, values] = await Promise.all([req(tx.objectStore(STORE).getAllKeys()), req(tx.objectStore(STORE).getAll())]);
      const m = new Map<string, string>();
      keys.forEach((k, i) => { if (typeof k === "string" && typeof values[i] === "string") m.set(k, values[i] as string); });
      // Station data in localStorage: moved in on the first open after the update; found again later
      // (an older saved copy opened offline) it only adds visits / patients (see merge).
      const moved: [string, string][] = [];
      const found: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !isData(k)) continue;
        found.push(k);
        const v = localStorage.getItem(k) ?? "";
        const cur = m.get(k);
        const next = cur == null ? v : merge(k, cur, v);
        if (next !== cur) moved.push([k, next]);
      }
      if (moved.length) {
        const w = d.transaction(STORE, "readwrite");
        for (const [k, v] of moved) w.objectStore(STORE).put(v, k);
        await done(w);
        for (const [k, v] of moved) m.set(k, v);
      }
      for (const k of found) localStorage.removeItem(k);
      d.onversionchange = () => d.close();
      db = d; mem = m;
      // A save still on its way to disk (it takes milliseconds): ask before the page closes.
      window.addEventListener("beforeunload", (e) => { if (pending.size) e.preventDefault(); });
      if (typeof BroadcastChannel !== "undefined") {
        chan = new BroadcastChannel("lab-kv");
        chan.onmessage = (e: MessageEvent<{ k: string; v: string | null }>) => {
          if (!mem || typeof e.data?.k !== "string") return;
          if (e.data.v == null) mem.delete(e.data.k); else mem.set(e.data.k, e.data.v);
        };
      }
      return true;
    } catch {
      return false;
    }
  })();
  return ready;
}

/** A write that IndexedDB refused (disk full…): shown by LocalDataGate. */
export const KV_ERROR_EVENT = "lab-kv-error";
const pending = new Set<Promise<void>>();
function persist(k: string, v: string | null) {
  try {
    const tx = db!.transaction(STORE, "readwrite");
    if (v == null) tx.objectStore(STORE).delete(k); else tx.objectStore(STORE).put(v, k);
    const p = done(tx).catch(() => { window.dispatchEvent(new Event(KV_ERROR_EVENT)); });
    pending.add(p);
    p.finally(() => pending.delete(p));
  } catch {
    window.dispatchEvent(new Event(KV_ERROR_EVENT));
  }
  chan?.postMessage({ k, v });
}

/** Resolves once every write so far is on disk — call before reloading the page (e.g. after a restore). */
export async function kvFlush(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}

export function kvGet(k: string): string | null {
  if (mem && isData(k)) return mem.get(k) ?? null;
  try { return localStorage.getItem(k); } catch { return null; }
}
/** Returns false when the browser refused the write. */
export function kvSet(k: string, v: string): boolean {
  if (mem && isData(k)) { mem.set(k, v); persist(k, v); return true; }
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}
export function kvRemove(k: string): void {
  if (mem && isData(k)) { mem.delete(k); persist(k, null); return; }
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}
/** Approximate bytes kept under this prefix (UTF-16 ≈ 2 bytes a character). */
export function kvBytes(prefix: string): number {
  let bytes = 0;
  if (mem) for (const [k, v] of mem) if (k.startsWith(prefix)) bytes += (k.length + v.length) * 2;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && !(mem && isData(k))) bytes += (k.length + (localStorage.getItem(k) ?? "").length) * 2;
    }
  } catch { /* ignore */ }
  return bytes;
}
/** True once the data lives in IndexedDB (false: still on localStorage). */
export const kvLarge = () => mem !== null;

/** What the browser allows this site: used and available bytes (null when it does not say). */
export async function storageQuota(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.quota ? { usage: e.usage ?? 0, quota: e.quota } : null;
  } catch { return null; }
}
