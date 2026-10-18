"use client";

/**
 * The stock room's counts on several computers. Each stock item carries a `tally`: the count it
 * started from (`base`) and, per computer, everything that computer added and took out (`d`, two
 * totals that only ever grow). The count is base + all added − all taken out.
 *
 * So when two computers change the same item between syncs (one issues 2 tubes, the other buys
 * 10), the sync adds both instead of keeping only the later count: for each computer the larger
 * totals are kept — the same records arriving twice, or in any order, change nothing.
 *
 * - Every station keeps writing the count as before (`qty`); `stampStock` turns the difference
 *   into this computer's totals when the list is saved.
 * - The other fields (name, minimum, expiry…) still follow «the later change wins».
 * - An item from an older version (no tally) starts one from its count the first time it changes.
 */

import { kvGet, kvSet } from "./kv";

export const STOCK_KEY = "station.stock.v1";
/** Same key as lib/local/fileSync DEVICE_KEY (this computer's sync name; kept on this computer). */
const DEVICE_KEY = "station.syncDevice.v1";

export interface StockTally { base: number; d: Record<string, [number, number]> }
type Item = { id: string; qty?: unknown; tally?: StockTally } & Record<string, unknown>;

const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const isTally = (t: unknown): t is StockTally =>
  !!t && typeof t === "object" && typeof (t as StockTally).base === "number" && !!(t as StockTally).d && typeof (t as StockTally).d === "object";

/** The count a tally gives. */
export function tallyQty(t: StockTally): number {
  let n = t.base;
  for (const v of Object.values(t.d)) n += num(v?.[0]) - num(v?.[1]);
  return round(n);
}

function deviceId(): string {
  try {
    const d = JSON.parse(kvGet(DEVICE_KEY) ?? "{}") as { id?: string; name?: string };
    if (d?.id) return d.id;
  } catch { /* make one */ }
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  kvSet(DEVICE_KEY, JSON.stringify({ id, name: "" }));
  return id;
}

/** A stock list about to be saved on this computer, with each count change written into this
 *  computer's totals (`before`: the list as stored now). */
export function stampStock<T extends { id: string; qty: number }>(before: T[], list: T[]): T[] {
  const prev = new Map((before as unknown as Item[]).map((s) => [s.id, s]));
  let dev: string | null = null;
  return list.map((s) => {
    const it = s as unknown as Item;
    const was = prev.get(it.id);
    const start: StockTally = isTally(it.tally) ? it.tally : isTally(was?.tally) ? was!.tally! : { base: num(was ? was.qty : it.qty), d: {} };
    const qty = num(it.qty);
    const delta = round(qty - tallyQty(start));
    if (!delta && it.tally === start) return s;
    dev ??= deviceId();
    const [plus, minus] = start.d[dev] ?? [0, 0];
    const d = delta ? { ...start.d, [dev]: [round(plus + Math.max(0, delta)), round(minus + Math.max(0, -delta))] as [number, number] } : start.d;
    return { ...s, qty, tally: { base: start.base, d } };
  });
}

/** One item as both computers hold it: `winner`'s fields (the later change), both computers'
 *  totals (the larger of each), and the count they give. Without a tally on either side the
 *  winner is kept as it is (an older version). `floor`: the count's lower limit (stockFloor). */
export function mergeStockItem<T>(winner: T, other: unknown, floor: (n: number) => number = (n) => n): T {
  const w = winner as unknown as Item, o = other as Item | null;
  if (!w || typeof w !== "object" || !o || typeof o !== "object" || !isTally(w.tally) || !isTally(o.tally)) return winner;
  const d: StockTally["d"] = { ...w.tally.d };
  for (const [k, v] of Object.entries(o.tally.d)) {
    const m = d[k] ?? [0, 0];
    d[k] = [Math.max(num(m[0]), num(v?.[0])), Math.max(num(m[1]), num(v?.[1]))];
  }
  const tally = { base: w.tally.base, d };
  return { ...w, tally, qty: floor(tallyQty(tally)) } as unknown as T;
}

/** The larger totals of `other` that `mine` lacks (so `mine` has news to send back). */
export function tallyAhead(mine: unknown, other: unknown): boolean {
  const a = (mine as Item | null)?.tally, b = (other as Item | null)?.tally;
  if (!isTally(a)) return false;
  if (!isTally(b)) return Object.keys(a.d).length > 0;
  return Object.entries(a.d).some(([k, v]) => num(v?.[0]) > num(b.d[k]?.[0]) || num(v?.[1]) > num(b.d[k]?.[1]));
}
