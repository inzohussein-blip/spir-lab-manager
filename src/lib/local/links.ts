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
const K_STOCK = "station.stock.v1";
export const stockItems = () => list<StockRef>(K_STOCK);
/** Take units out of a stock item (never below 0). */
export function takeFromStock(id: string | undefined, units = 1): void {
  if (!id) return;
  const all = stockItems();
  if (!all.some((s) => s.id === id)) return;
  kvSet(K_STOCK, JSON.stringify(all.map((s) => (s.id === id ? { ...s, qty: Math.max(0, Number(s.qty) - units) } : s))));
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
