"use client";

/**
 * «محطة المزامنة»: the lab's computers bring each other's changes in, by file (a USB stick, a
 * shared folder, WhatsApp…) or automatically over the network (lib/sync, «المزامنة التلقائية»).
 *
 * - Every station page notes when each record changed on this computer (a visit, a patient, a
 *   stock item…): the «record clock», kept on this computer only.
 * - «ملف المزامنة» holds every shared station record with its time, and the records deleted here.
 * - Bringing a file in merges it record by record: one this computer lacks is added, one both have
 *   is taken from the file only when it changed there later, one deleted there later is deleted
 *   here. Nothing else on this computer changes. Data from before the clock started counts as
 *   oldest, so on a first sync each computer keeps its own copy of a record both already had.
 * - Settings and other single values follow the same rule as one record each.
 */

import { kvFlush, kvGet, kvSet, kvRemove, kvSyncedEntries as kvAllSynced, isSyncedKey as kvIsSynced, onKvChange, KV_REMOTE_EVENT } from "@/lib/local/kv";
import { sharedStation, syncMasterOn } from "@/lib/sync/protocol";
import { todayYmd } from "@/lib/local/util";

// Stations this computer keeps to itself («محطة المزامنة ← الإعدادات») stay out of the files both ways.
const isSyncedKey = (k: string) => kvIsSynced(k) && sharedStation(k);
const kvSyncedEntries = () => kvAllSynced().filter(([k]) => sharedStation(k));

/** On this computer only (see DEVICE_ONLY in ./kv). */
export const CLOCK_KEY = "station.syncClock.v1";
export const DEVICE_KEY = "station.syncDevice.v1";
export const LOG_KEY = "station.syncLog.v1";

/** "coll\nid" → [when it changed here (ms), 1 when that change deleted it]. */
type Clock = Record<string, [number, 0 | 1]>;
const ck = (coll: string, id: string) => `${coll}\n${id}`;

function readJson<T>(k: string, fallback: T): T {
  try { const v = kvGet(k); return v == null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
}

// ── Records of a stored value (as the network sync splits them) ─────────────
type Rec = { id: string } & Record<string, unknown>;
const isRecList = (x: unknown): x is Rec[] => Array.isArray(x) && x.every((e) => !!e && typeof e === "object" && typeof (e as Rec).id === "string");
/** id → its JSON for a list of records; "_" → the whole value otherwise. */
function split(v: string | null): Map<string, string> {
  const m = new Map<string, string>();
  if (v == null) return m;
  try {
    const x = JSON.parse(v) as unknown;
    if (isRecList(x)) { for (const e of x) m.set(e.id, JSON.stringify(e)); return m; }
  } catch { /* not JSON: one value */ }
  m.set("_", v);
  return m;
}

// ── The record clock ─────────────────────────────────────────────────────────
let clock: Clock | null = null;
let importing = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function loadClock(): Clock { return (clock ??= readJson<Clock>(CLOCK_KEY, {})); }
/** Saved soon after a change, merged with what another open tab may have written meanwhile. */
function saveClock(now = false) {
  const run = () => {
    saveTimer = null;
    const mine = loadClock();
    const theirs = readJson<Clock>(CLOCK_KEY, {});
    for (const [k, v] of Object.entries(theirs)) if (!mine[k] || mine[k][0] < v[0]) mine[k] = v;
    kvSet(CLOCK_KEY, JSON.stringify(mine));
  };
  if (saveTimer) clearTimeout(saveTimer);
  if (now) run(); else saveTimer = setTimeout(run, 800);
}

let started = false;
/** Start noting this computer's changes (every station page calls it once its data is loaded). */
export function startSyncClock() {
  if (started || typeof window === "undefined") return;
  started = true;
  loadClock();
  onKvChange((k, prev, next, origin) => {
    if (importing || origin !== "local" || !isSyncedKey(k)) return;
    const old = split(prev), neu = split(next);
    const t = Date.now();
    const c = loadClock();
    let changed = false;
    for (const [id, j] of neu) if (old.get(id) !== j) { c[ck(k, id)] = [t, 0]; changed = true; }
    for (const id of old.keys()) if (!neu.has(id)) { c[ck(k, id)] = [t, 1]; changed = true; }
    if (changed) saveClock();
  });
  window.addEventListener("pagehide", () => { if (saveTimer) saveClock(true); });
}

// ── This computer ────────────────────────────────────────────────────────────
export interface SyncDevice { id: string; name: string }
export function thisDevice(): SyncDevice {
  const d = readJson<Partial<SyncDevice>>(DEVICE_KEY, {});
  if (d.id) return { id: d.id, name: d.name ?? "" };
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  kvSet(DEVICE_KEY, JSON.stringify({ id, name: "" }));
  return { id, name: "" };
}
export function setDeviceName(name: string) {
  kvSet(DEVICE_KEY, JSON.stringify({ ...thisDevice(), name: name.trim().slice(0, 40) }));
}

export interface SyncLogEntry { at: number; dir: "out" | "in"; device: string; added: number; updated: number; removed: number; records: number }
export const syncLog = (): SyncLogEntry[] => readJson<SyncLogEntry[]>(LOG_KEY, []);
export const clearSyncLog = () => kvSet(LOG_KEY, "[]");
function addLog(e: SyncLogEntry) { kvSet(LOG_KEY, JSON.stringify([e, ...syncLog()].slice(0, 30))); }

/** How many shared records each station holds here (for the station's summary). */
export function recordCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of kvSyncedEntries()) {
    const n = split(v).size;
    const station = k.split(".")[0];
    out[station] = (out[station] ?? 0) + n;
  }
  return out;
}

// ── The sync file ────────────────────────────────────────────────────────────
export interface SyncFile {
  app: "spir-sync";
  version: 1;
  at: number;
  device: SyncDevice;
  /** The lab code this computer is activated with ("" on a computer without one): a file goes
   *  only into computers of the same lab. */
  company?: string;
  /** Per data key: its records (a list) or its whole value ("_"), each with when it changed; a
   *  deleted one has no data. */
  colls: Record<string, Record<string, { t: number; d?: unknown; raw?: string; del?: 1 }>>;
}
export const isSyncFile = (x: unknown): x is SyncFile =>
  !!x && typeof x === "object" && (x as SyncFile).app === "spir-sync" && !!(x as SyncFile).colls && typeof (x as SyncFile).colls === "object";

/** The lab this computer belongs to (its activated code), "" when it has none. */
async function companyOf(): Promise<string> {
  try { return (await (await import("@/lib/license/client")).licenseIdentity())?.lid ?? ""; } catch { return ""; }
}

export async function exportSync(): Promise<SyncFile> {
  if (!syncMasterOn()) throw new Error("paused"); // «إيقاف المزامنة»: no file leaves this computer
  saveClock(true);
  const c = loadClock();
  const colls: SyncFile["colls"] = {};
  const put = (coll: string, id: string, e: SyncFile["colls"][string][string]) => { (colls[coll] ??= {})[id] = e; };
  let records = 0;
  for (const [k, v] of kvSyncedEntries()) {
    let x: unknown = undefined;
    try { x = JSON.parse(v); } catch { /* raw text */ }
    if (isRecList(x)) for (const r of x) { put(k, r.id, { t: c[ck(k, r.id)]?.[0] ?? 0, d: r }); records++; }
    else { put(k, "_", { t: c[ck(k, "_")]?.[0] ?? 0, raw: v }); records++; }
  }
  // What was deleted here, so the other computer deletes it too (unless it changed it later).
  for (const [key, [t, del]] of Object.entries(c)) {
    if (!del) continue;
    const [coll, id] = key.split("\n");
    if (isSyncedKey(coll) && !colls[coll]?.[id]) put(coll, id, { t, del: 1 });
  }
  const device = thisDevice();
  addLog({ at: Date.now(), dir: "out", device: device.name || device.id, added: 0, updated: 0, removed: 0, records });
  return { app: "spir-sync", version: 1, at: Date.now(), device, company: await companyOf(), colls };
}
export const syncFileName = () => {
  const d = thisDevice();
  return `spir-sync-${(d.name || d.id).replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${todayYmd()}.json`;
};

export interface ImportResult { ok: boolean; added: number; updated: number; removed: number; kept: number; from?: string; error?: string }

/** Patients, stock items and tests entered separately on two computers under the same name (after
 *  a first sync each keeps its own): listed so they can be merged by hand — nothing is merged
 *  automatically, since visits and stock point at each one. */
export function sameNameRecords(): { patients: string[]; stock: string[]; tests: string[] } {
  const dupes = (k: string, field: "name" | "name_ar") => {
    const seen = new Map<string, number>();
    for (const r of readJson<Record<string, unknown>[]>(k, [])) {
      const n = String(r?.[field] ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      if (n) seen.set(n, (seen.get(n) ?? 0) + 1);
    }
    return [...seen].filter(([, c]) => c > 1).map(([n]) => n);
  };
  return { patients: dupes("station.patients.v1", "name"), stock: dupes("station.stock.v1", "name"), tests: dupes("station.tests.v1", "name_ar") };
}

/** Bring another computer's sync file in (see the top of this file for the rule). */
export async function importSync(raw: unknown): Promise<ImportResult> {
  if (!isSyncFile(raw)) return { ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "not_sync" };
  if (!syncMasterOn()) return { ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "paused" };
  const me = thisDevice();
  if (raw.device?.id === me.id) return { ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "same_device" };
  // Another lab's computer: its records never come in here.
  if ((raw.company ?? "") !== (await companyOf())) return { ok: false, added: 0, updated: 0, removed: 0, kept: 0, error: "other_company" };
  const c = loadClock();
  let added = 0, updated = 0, removed = 0, kept = 0;
  importing = true;
  try {
    for (const [coll, recs] of Object.entries(raw.colls)) {
      if (!isSyncedKey(coll) || !recs || typeof recs !== "object") continue;
      const cur = kvGet(coll);
      // A single value ("_"): taken when it changed later there, or when this computer lacks it.
      if (recs._) {
        const f = recs._, local = c[ck(coll, "_")];
        const lt = cur == null ? (local?.[1] ? local[0] : -1) : local?.[0] ?? 0;
        if (f.t > lt && !(cur == null && f.del)) {
          if (f.del) { kvRemove(coll); removed++; }
          else if (typeof f.raw === "string" && f.raw !== cur) { kvSet(coll, f.raw); if (cur == null) added++; else updated++; }
          c[ck(coll, "_")] = [f.t, f.del ? 1 : 0];
        } else if (cur != null) kept++;
        continue;
      }
      let arr: Rec[] = [];
      try { const x = cur == null ? [] : JSON.parse(cur); if (isRecList(x)) arr = x; else if (cur != null) continue; } catch { if (cur != null) continue; }
      let dirty = false;
      for (const [id, f] of Object.entries(recs)) {
        if (!f || typeof f.t !== "number") continue;
        const i = arr.findIndex((r) => r.id === id);
        const local = c[ck(coll, id)];
        const lt = i < 0 ? (local?.[1] ? local[0] : -1) : local?.[0] ?? 0;
        if (!(f.t > lt)) { if (i >= 0) kept++; continue; }
        if (f.del) {
          if (i >= 0) { arr.splice(i, 1); removed++; dirty = true; }
        } else if (f.d && typeof f.d === "object" && (f.d as Rec).id === id) {
          if (i < 0) { arr.push(f.d as Rec); added++; dirty = true; }
          else if (JSON.stringify(arr[i]) !== JSON.stringify(f.d)) { arr[i] = f.d as Rec; updated++; dirty = true; }
        } else continue;
        c[ck(coll, id)] = [f.t, f.del ? 1 : 0];
      }
      if (dirty) kvSet(coll, JSON.stringify(arr));
    }
  } finally {
    importing = false;
  }
  saveClock(true);
  addLog({ at: Date.now(), dir: "in", device: raw.device?.name || raw.device?.id || "?", added, updated, removed, records: added + updated + removed });
  await kvFlush();
  try { window.dispatchEvent(new CustomEvent(KV_REMOTE_EVENT, { detail: added + updated + removed })); } catch { /* ignore */ }
  return { ok: true, added, updated, removed, kept, from: raw.device?.name || raw.device?.id };
}
