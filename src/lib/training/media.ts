"use client";

/**
 * Image store for the standalone Training station. Images live in IndexedDB
 * (large quota — hundreds of MB), not localStorage (~5 MB), so photos of tubes,
 * samples and microscopy never crowd out the text data. Nothing here is shared
 * with the Lab Station or any other app.
 */

export interface MediaRecord {
  id: string;
  blob: Blob;
  caption: string;
  created_at: number;
  w: number;
  h: number;
}
export type MediaMeta = Omit<MediaRecord, "blob"> & { size: number; type: string };

const DB_NAME = "training-media";
const STORE = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    let out: T;
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => { db.close(); resolve(out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Downscale to ≤ 1400px and re-encode as JPEG (small PNGs keep transparency). */
async function compress(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const MAX = 1400;
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  if (file.type === "image/png" && file.size < 400_000 && scale === 1) {
    bmp.close();
    return { blob: file, w, h };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
  return { blob, w, h };
}

/** Add an image (compressed) and return its id. */
export async function addImage(file: Blob, caption = ""): Promise<string> {
  const { blob, w, h } = await compress(file);
  const rec: MediaRecord = { id: newId(), blob, caption, created_at: Date.now(), w, h };
  await tx("readwrite", (s) => s.put(rec));
  return rec.id;
}

export async function getImage(id: string): Promise<MediaRecord | undefined> {
  return tx<MediaRecord | undefined>("readonly", (s) => s.get(id));
}

export async function listImages(): Promise<MediaMeta[]> {
  const all = await tx<MediaRecord[]>("readonly", (s) => s.getAll());
  return (all ?? [])
    .map(({ blob, ...m }) => ({ ...m, size: blob.size, type: blob.type }))
    .sort((a, b) => b.created_at - a.created_at);
}

export async function setCaption(id: string, caption: string): Promise<void> {
  const rec = await getImage(id);
  if (!rec) return;
  await tx("readwrite", (s) => s.put({ ...rec, caption }));
}

export async function deleteImage(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

// ── Object-URL cache for <img> display ───────────────────────────────────────
const urlCache = new Map<string, string>();
export async function imageUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const rec = await getImage(id);
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}

// ── Backup helpers ───────────────────────────────────────────────────────────
export interface MediaExport { id: string; caption: string; created_at: number; w: number; h: number; dataUrl: string }

const toDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

export async function exportImages(): Promise<MediaExport[]> {
  const all = await tx<MediaRecord[]>("readonly", (s) => s.getAll());
  return Promise.all((all ?? []).map(async ({ blob, ...m }) => ({ ...m, dataUrl: await toDataUrl(blob) })));
}

/** Replace every stored image with the backup's images. */
export async function importImages(items: MediaExport[]): Promise<void> {
  const recs: MediaRecord[] = await Promise.all(
    items.map(async ({ dataUrl, ...m }) => ({ ...m, blob: await (await fetch(dataUrl)).blob() }))
  );
  await tx("readwrite", (s) => { s.clear(); });
  for (const r of recs) await tx("readwrite", (s) => s.put(r));
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
}
