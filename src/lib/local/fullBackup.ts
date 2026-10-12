"use client";

/**
 * «النسخة الشاملة»: one file with every station's data on this device (lib/local/kv), the training
 * station's images, and the device's appearance and PIN choices — instead of one backup per station.
 * It is also how a lab moves to another computer or to the local copy of the app (a site's data
 * stays with its address, so the file carries it across).
 *
 * Left out on purpose: the device's lab code and identity (local.*), and this computer's sync
 * identity and secrets — a restore on another computer must not make it a clone of this one.
 *
 * «الحفظ التلقائي»: the browser keeps a folder the lab chose (Chrome / Edge, with the user's
 * permission) and a station writes a new file there once a day or a week when it opens; the last
 * KEEP_FILES stay. Without the permission (or the feature) a reminder asks for a backup instead.
 */

import { kvReady, kvDataEntries, kvIsDataKey, kvSet, kvRemove, kvFlush } from "./kv";
import { exportImages, importImages, type MediaExport } from "@/lib/training/media";
import { UI_KEY, UI_COLOR_KEY } from "./uiScript";
import { thisDevice } from "./fileSync";

export const FULL_APP = "spir-lab-full";
export interface FullBackup {
  app: typeof FULL_APP;
  v: 1;
  at: number;
  /** The computer's name in «محطة المزامنة», when set. */
  from?: string;
  data: Record<string, string>;
  settings: Record<string, string>;
  images: MediaExport[];
}

/** Station data that stays with this computer (its sync identity and log). */
const NOT_IN_BACKUP = new Set(["station.syncDevice.v1", "station.syncClock.v1", "station.syncLog.v1"]);
/** Device choices kept in localStorage that go with the lab's data. */
const SETTINGS = (k: string) => k.endsWith(".theme.v1") || k === "lab-theme" || k === UI_KEY || k === UI_COLOR_KEY || k === "local.pin.v1" || k === "lab-sync-exclude";

const STATE_KEY = "local.backup.v1";
export const DAY = 86_400_000;
/** Remind when there is no backup this many days after the last one (or after the first use). */
export const REMIND_DAYS = 7;
export const KEEP_FILES = 10;
export interface BackupState {
  /** Last full backup (downloaded or saved to the folder). */
  last?: number;
  /** When this device first held data with no backup yet (the reminder counts from there). */
  since?: number;
  /** Automatic save to the folder: every N days (0 = off). */
  every?: number;
  /** Name of the chosen folder (the handle itself is in IndexedDB). */
  folder?: string;
  /** The last automatic save failed (no permission any more, folder gone). */
  failed?: boolean;
  /** «لاحقاً» on the reminder: not shown again before this time. */
  snooze?: number;
}
export function backupState(): BackupState {
  try { const v = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null") as BackupState | null; return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export function setBackupState(patch: Partial<BackupState>): BackupState {
  const next = { ...backupState(), ...patch };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(BACKUP_EVENT));
  return next;
}
export const BACKUP_EVENT = "lab-full-backup";
/** A full backup holds the lab station's data too: its own «آخر نسخة احتياطية» counts it. */
const stationBackedUp = () => { kvSet("station.backupAt.v1", JSON.stringify(Date.now())); };

export const backupFileName = (t = Date.now()) => `spir-lab-backup-${new Date(t).toLocaleDateString("en-CA")}.json`;

export async function makeFullBackup(): Promise<FullBackup> {
  await kvReady();
  const data: Record<string, string> = {};
  for (const [k, v] of kvDataEntries()) if (!NOT_IN_BACKUP.has(k)) data[k] = v;
  const settings: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && SETTINGS(k)) settings[k] = localStorage.getItem(k) ?? "";
    }
  } catch { /* ignore */ }
  let images: MediaExport[] = [];
  try { images = await exportImages(); } catch { /* no image store in this browser */ }
  let from: string | undefined;
  try { from = thisDevice().name || undefined; } catch { /* none */ }
  return { app: FULL_APP, v: 1, at: Date.now(), from, data, settings, images };
}

export function isFullBackup(x: unknown): x is FullBackup {
  const b = x as Partial<FullBackup> | null;
  return !!b && b.app === FULL_APP && b.v === 1 && typeof b.at === "number" && !!b.data && typeof b.data === "object" && !Array.isArray(b.data);
}

/** What a full backup holds, per station: its records (a list counts its items, anything else one). */
export function backupSummary(b: FullBackup): [string, number][] {
  const per = new Map<string, number>();
  for (const [k, v] of Object.entries(b.data)) {
    if (k.endsWith(".theme.v1")) continue;
    let n = 1;
    try { const x = JSON.parse(v) as unknown; if (Array.isArray(x)) n = x.length; } catch { /* a plain value */ }
    const st = k.split(".")[0];
    per.set(st, (per.get(st) ?? 0) + n);
  }
  return [...per].filter(([, n]) => n > 0);
}

/** Replace this device's stations' data with the backup's (what is not in it is removed). */
export async function restoreFullBackup(b: FullBackup): Promise<void> {
  await kvReady();
  const keep = new Set(Object.keys(b.data).filter((k) => kvIsDataKey(k) && !NOT_IN_BACKUP.has(k)));
  for (const [k] of kvDataEntries()) if (!keep.has(k) && !NOT_IN_BACKUP.has(k)) kvRemove(k);
  for (const k of keep) { const v = b.data[k]; if (typeof v === "string") kvSet(k, v); }
  for (const [k, v] of Object.entries(b.settings ?? {})) if (SETTINGS(k) && typeof v === "string") { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  if (Array.isArray(b.images)) { try { await importImages(b.images); } catch { /* no image store */ } }
  await kvFlush();
  setBackupState({ last: Date.now(), since: undefined });
}

/** True when this device holds any station data worth keeping (not just settings). */
export function hasData(): boolean {
  return kvDataEntries().some(([k, v]) => !k.endsWith(".theme.v1") && !NOT_IN_BACKUP.has(k) && v.length > 2 && !/(settings|seeded|catalogVersion|backupAt|deviceTag|unlocked)/i.test(k));
}

export async function downloadFullBackup(): Promise<void> {
  const blob = new Blob([JSON.stringify(await makeFullBackup())], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = backupFileName(); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  stationBackedUp();
  setBackupState({ last: Date.now(), since: undefined, snooze: undefined });
}

// ── The folder for automatic saves (File System Access, kept in IndexedDB) ──

type Perm = "granted" | "denied" | "prompt";
interface DirHandle {
  name: string;
  queryPermission?(o: { mode: "readwrite" }): Promise<Perm>;
  requestPermission?(o: { mode: "readwrite" }): Promise<Perm>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }> }>;
  removeEntry(name: string): Promise<void>;
  keys(): AsyncIterable<string>;
}
const H_DB = "lab-backup-folder";
const H_STORE = "h";
function hdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(H_DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(H_STORE)) r.result.createObjectStore(H_STORE); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function hget(): Promise<DirHandle | null> {
  try {
    const d = await hdb();
    return await new Promise((res) => { const r = d.transaction(H_STORE).objectStore(H_STORE).get("dir"); r.onsuccess = () => res((r.result as DirHandle) ?? null); r.onerror = () => res(null); });
  } catch { return null; }
}
async function hput(h: DirHandle | null): Promise<void> {
  const d = await hdb();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(H_STORE, "readwrite");
    if (h) tx.objectStore(H_STORE).put(h, "dir"); else tx.objectStore(H_STORE).delete("dir");
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

/** The browser can keep a folder (Chrome / Edge on a computer). */
export const folderSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** Choose the folder (from a click) and switch automatic saving on, every `every` days. */
export async function chooseFolder(every: number): Promise<boolean> {
  try {
    const pick = (window as unknown as { showDirectoryPicker(o: { mode: "readwrite"; id?: string }): Promise<DirHandle> }).showDirectoryPicker;
    const h = await pick({ mode: "readwrite", id: "lab-backup" });
    await hput(h);
    setBackupState({ folder: h.name, every, failed: false });
    return await saveToFolder(h);
  } catch { return false; }
}
export async function stopAutoSave(): Promise<void> {
  try { await hput(null); } catch { /* ignore */ }
  setBackupState({ folder: undefined, every: 0, failed: false });
}

async function saveToFolder(h: DirHandle): Promise<boolean> {
  try {
    const f = await h.getFileHandle(backupFileName(), { create: true });
    const w = await f.createWritable();
    await w.write(JSON.stringify(await makeFullBackup()));
    await w.close();
    // Keep the last KEEP_FILES backups (the names sort by date).
    const names: string[] = [];
    for await (const n of h.keys()) if (/^spir-lab-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)) names.push(n);
    names.sort();
    for (const n of names.slice(0, Math.max(0, names.length - KEEP_FILES))) { try { await h.removeEntry(n); } catch { /* ignore */ } }
    stationBackedUp();
    setBackupState({ last: Date.now(), since: undefined, failed: false, snooze: undefined });
    return true;
  } catch {
    setBackupState({ failed: true });
    return false;
  }
}

/** Save to the folder now. From a click it may ask the browser's permission again. */
export async function saveNow(fromClick = false): Promise<boolean> {
  const h = await hget();
  if (!h) return false;
  let p: Perm = (await h.queryPermission?.({ mode: "readwrite" })) ?? "granted";
  if (p !== "granted" && fromClick) p = (await h.requestPermission?.({ mode: "readwrite" })) ?? "denied";
  if (p !== "granted") { setBackupState({ failed: true }); return false; }
  return saveToFolder(h);
}

/** When a station opens: count from the first data, and save to the folder when one is due. */
export async function backupTick(): Promise<void> {
  const s = backupState();
  if (!s.last && !s.since && hasData()) setBackupState({ since: Date.now() });
  if (s.every && s.every > 0 && s.folder && (!s.last || Date.now() - s.last >= s.every * DAY)) await saveNow(false);
}

/** Days since the last backup (or since the first data, never backed up) when a reminder is due; else null. */
export function reminderDue(now = Date.now()): { days: number; never: boolean } | null {
  const s = backupState();
  if (s.snooze && now < s.snooze) return null;
  const from = s.last ?? s.since;
  if (!from) return null;
  const days = Math.floor((now - from) / DAY);
  return days >= REMIND_DAYS || (s.failed && s.every) ? { days, never: !s.last } : null;
}
