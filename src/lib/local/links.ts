"use client";

/**
 * What the local stations share on one computer (all but training): each reads the others' lists
 * straight from the device's storage, without seeding or changing them.
 *  - the stock room (station.stock.v1): the lab station deducts a unit per linked test, procurement
 *    adds what it buys, quality deducts a unit of a control material per control run;
 *  - the lab station's tests: names offered for quality's analytes;
 *  - the staff (roster): names offered wherever a station asks who did it;
 *  - procurement's suppliers: offered as a device's supplier in quality.
 */

import { kvGet, kvSet } from "@/lib/local/kv";

function list<T>(key: string): T[] {
  try { const v = JSON.parse(kvGet(key) ?? "[]"); return Array.isArray(v) ? (v as T[]) : []; } catch { return []; }
}

export interface StockRef { id: string; name: string; qty: number; minQty?: number; expiry?: string; linkedTestId?: string }

// ── Stock movement log ─────────────────────────────────────────────────────────
/** Why a stock count changed. */
export type MoveReason = "purchase" | "purchase-del" | "result" | "qc" | "add" | "issue" | "count" | "edit";
export const MOVE_LABEL: Record<MoveReason, string> = {
  purchase: "شراء", "purchase-del": "حذف شراء", result: "نتائج محطة المختبر", qc: "سيطرة نوعية",
  add: "إضافة يدوية", issue: "صرف يدوي", count: "جرد", edit: "تعديل الصنف",
};
/** One change of a stock item's count: every purchase, result, control run, manual add / issue,
 *  stocktake and edit — so each unit can be traced. The newest MOVES_MAX are kept. */
export interface StockMove { id: string; at: number; stockId: string; name: string; delta: number; after: number; reason: MoveReason; ref?: string }
const K_MOVES = "station.stockMoves.v1";
const MOVES_MAX = 3000;
export const getMoves = () => list<StockMove>(K_MOVES);
const moveId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
/** Record the count changes between two versions of the stock list. */
export function logStockMoves(before: StockRef[], after: StockRef[], reason: MoveReason, ref?: string): void {
  const was = new Map(before.map((x) => [x.id, Number(x.qty) || 0]));
  const at = Date.now();
  const moves: StockMove[] = [];
  for (const s of after) {
    const delta = (Number(s.qty) || 0) - (was.get(s.id) ?? 0);
    if (delta) moves.push({ id: moveId(), at, stockId: s.id, name: s.name, delta, after: Number(s.qty) || 0, reason, ...(ref ? { ref } : {}) });
  }
  if (moves.length) kvSet(K_MOVES, JSON.stringify([...moves, ...getMoves()].slice(0, MOVES_MAX)));
}
const K_STOCK = "station.stock.v1";
export const stockItems = () => list<StockRef>(K_STOCK);
/**
 * How the stock room behaves when a material runs out — one choice for every station on the
 * computer (set from the lab station's or procurement's settings; synced with the stock room):
 *  - warnOut: warn when a result or a control run needs a material that is not in stock;
 *  - allowNegative: keep counting below zero (e.g. -1) instead of stopping at 0, so the stock
 *    room shows how much was used without stock.
 * Both off by default.
 */
export interface StockOptions {
  warnOut?: boolean; allowNegative?: boolean;
  /** How results use stock: "auto" (default) when a visit is saved in the lab station; "manual" —
   *  the results wait in «المخزن ← نتائج بانتظار الصرف» until someone issues (or skips) them.
   *  `manualSince`: when manual began (older visits never wait). */
  mode?: "auto" | "manual"; manualSince?: number;
}
const K_STOCK_OPT = "station.stockOptions.v1";
export function stockOptions(): StockOptions {
  try { const v = JSON.parse(kvGet(K_STOCK_OPT) ?? "{}"); return v && typeof v === "object" ? (v as StockOptions) : {}; } catch { return {}; }
}
export function setStockOptions(patch: StockOptions): void {
  kvSet(K_STOCK_OPT, JSON.stringify({ ...stockOptions(), ...patch }));
}
/** A new stock count: below zero only when the lab allows it. */
export const stockFloor = (n: number): number => (stockOptions().allowNegative ? n : Math.max(0, n));

// ── Quality control runs ↔ stock ────────────────────────────────────────────────
/** Control runs whose unit of control material was already taken (or skipped by hand), by
 *  "<analyteId>|<levelId>|<date>" — so a run never uses stock twice, whichever way it was issued. */
const K_QC_USED = "station.stockUsedQc.v1";
const QC_USED_DAYS = 60;
const qcUsed = (): Record<string, number> => { try { return JSON.parse(kvGet(K_QC_USED) ?? "{}") ?? {}; } catch { return {}; } };
function markQcUsed(key: string): void {
  const used = qcUsed(), cut = Date.now() - QC_USED_DAYS * 86400000;
  for (const [k, at] of Object.entries(used)) if (at < cut) delete used[k];
  used[key] = Date.now();
  kvSet(K_QC_USED, JSON.stringify(used));
}
export const qcRunKey = (analyteId: string, levelId: string, date: string) => `${analyteId}|${levelId}|${date}`;
/** A new control run: its material leaves the stock room now (automatic), or waits to be issued (manual). */
export function qcRunStock(key: string, stockId: string | undefined, ref?: string): void {
  if (!stockId || stockOptions().mode === "manual" || qcUsed()[key]) return;
  takeFromStock(stockId, 1, ref);
  markQcUsed(key);
}
/** A control run waiting (manual) for its unit of control material. */
export interface PendingQc { key: string; analyte: string; level: string; date: string; stockId: string; stock: string; qty: number }
export function pendingQcStock(): PendingQc[] {
  const o = stockOptions();
  if (o.manualSince == null) return [];
  const since = Math.max(o.manualSince, Date.now() - QC_USED_DAYS * 86400000);
  const used = qcUsed(), stock = stockItems();
  const analytes = new Map(list<{ id: string; name: string; stockId?: string; levels?: { id: string; label: string }[] }>("qc.analytes.v1").map((a) => [a.id, a]));
  const out: PendingQc[] = [];
  for (const r of list<{ analyteId: string; levelId: string; date: string; at: number }>("qc.results.v1")) {
    const a = analytes.get(r.analyteId);
    const s = a?.stockId ? stock.find((x) => x.id === a.stockId) : undefined;
    const key = qcRunKey(r.analyteId, r.levelId, r.date);
    if (!a || !s || (r.at ?? 0) < since || used[key]) continue;
    out.push({ key, analyte: a.name, level: a.levels?.find((l) => l.id === r.levelId)?.label ?? "", date: r.date, stockId: s.id, stock: s.name, qty: Number(s.qty) || 0 });
  }
  return out;
}
/** Issue (take one unit) or skip a waiting control run. */
export function issueQcStock(p: PendingQc): void { if (!qcUsed()[p.key]) takeFromStock(p.stockId, 1, `${p.analyte}${p.level ? ` — ${p.level}` : ""} · ${p.date}`); markQcUsed(p.key); }
export function skipQcStock(p: PendingQc): void { markQcUsed(p.key); }

/** Take units out of a stock item (not below 0 unless negative stock is allowed). */
export function takeFromStock(id: string | undefined, units = 1, ref?: string): void {
  if (!id) return;
  const all = stockItems();
  if (!all.some((s) => s.id === id)) return;
  const next = all.map((s) => (s.id === id ? { ...s, qty: stockFloor(Number(s.qty) - units) } : s));
  kvSet(K_STOCK, JSON.stringify(next));
  logStockMoves(all, next, "qc", ref);
}

/** Active staff names (roster). */
export const staffNames = (): string[] =>
  list<{ name: string; active?: boolean }>("roster.staff.v1").filter((s) => s.active !== false && s.name?.trim()).map((s) => s.name.trim());
/** Procurement's suppliers. */
export const suppliers = (): { name: string; phone?: string }[] =>
  list<{ name: string; phone?: string }>("purchasing.suppliers.v1").filter((s) => s.name?.trim());
/** The lab station's test names (Arabic, with the English name when there is one). */
export const labTestNames = (): string[] =>
  list<{ name_ar: string; name_en?: string }>("station.tests.v1").map((t) => (t.name_en ? `${t.name_ar} (${t.name_en})` : t.name_ar));
/** Quality's analytes linked to a stock item, by stock id (for the stock room's «مرتبط» column). */
export function qcLinks(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const a of list<{ name: string; stockId?: string }>("qc.analytes.v1")) if (a.stockId) m.set(a.stockId, [...(m.get(a.stockId) ?? []), a.name]);
  return m;
}
