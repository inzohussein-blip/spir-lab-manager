"use client";

/**
 * Local, offline-first store for the Purchasing app. Everything lives in this browser's
 * storage (lib/local/kv — single machine, no database). Its stock room is the lab station's
 * (station.stock.v1): purchases add to it and the lab station deducts from it.
 */

import { kvGet, kvSet } from "@/lib/local/kv";
import { getStock, saveStock } from "@/lib/station/store";
import { stockFloor } from "@/lib/local/links";

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  note?: string;
}

export interface PurchaseItem {
  /** The device the material is for (optional; kept on the stock item when it has none). */
  device?: string;
  name: string;
  qty: number;
  /** Price of one (item or kit): the line total ÷ the quantity. */
  unitPrice: number;
  /** The line's total as typed («المجموع»); older lines have only qty × unitPrice. */
  total?: number;
  /** A kit bought (its contents go to the stock room, see Kit). */
  kitId?: string;
  /** Optional: the batch's expiry date (YYYY-MM-DD) and lot number, also noted on the stock item. */
  expiry?: string;
  lot?: string;
  /** The GS1 product code scanned from the box: kept as the item's (or kit's) barcode. */
  gtin?: string;
}

/** A kit: one purchasable package holding several stock items, e.g. «كت السكر» = 4 × «كاشف
 *  السكر» + 1 × «محلول المعايرة». Buying n kits adds n × each part to the stock room. */
export interface Kit {
  id: string;
  name: string;
  parts: { stockId: string; qty: number }[];
  barcode?: string;
}

/** A payment towards a purchase (Settings → «ديون الموردين»). */
export interface Payment { id: string; date: string; amount: number; note?: string }

export interface Purchase {
  id: string;
  created_at: number;
  date: string; // YYYY-MM-DD
  supplierId?: string;
  supplierName?: string;
  /** The supplier's own invoice number. */
  supplierRef?: string;
  items: PurchaseItem[];
  total: number;
  paid: boolean;
  notes?: string;
  /** Ordered and not received yet: nothing is in the stock room, and it is neither spending nor a
   *  debt, until «استلام» (receivePurchase). */
  ordered?: boolean;
  /** Quantities this purchase added to the stock room (taken back if it is deleted). */
  stockAdded?: { id: string; qty: number }[];
  /** Payments made so far (Settings → «ديون الموردين»); `paid` is set once they cover the total. */
  payments?: Payment[];
}

export interface PurchasingSettings {
  orgName: string;
  subtitle?: string;
  footer?: string;
  /** Letterhead logo (image data URL); empty → the default logo. */
  logo?: string;
  /** Optional features, each off by default: payments and balances per supplier, unit prices
   *  (stock value, cost per test), and barcodes on items and kits. */
  debts?: boolean;
  prices?: boolean;
  barcode?: boolean;
  /** «المشتريات»: the supplier's name and invoice number on the new purchase (hidden by default;
   *  always shown with supplier debts on, which need the supplier). */
  supplierFields?: boolean;
  /** «المشتريات»: the purchase date on the new purchase (hidden by default: today's date). */
  showDate?: boolean;
}

const K_SUP = "purchasing.suppliers.v1";
const K_PUR = "purchasing.purchases.v1";
const K_SET = "purchasing.settings.v1";
/** Kits live with the stock room (shared with the lab station's data, synced alike). */
const K_KITS = "station.kits.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = kvGet(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
/** Returns false when the browser refused the write (storage full or blocked). */
function write<T>(key: string, value: T): boolean {
  try {
    return kvSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const key = (s: string) => s.trim().toLowerCase();

// ── Suppliers ────────────────────────────────────────────────────────────────
export function getSuppliers(): Supplier[] {
  return read<Supplier[]>(K_SUP, []);
}
export function saveSuppliers(s: Supplier[]): void {
  write(K_SUP, s);
}

// ── Kits ─────────────────────────────────────────────────────────────────────
export function getKits(): Kit[] {
  return read<Kit[]>(K_KITS, []);
}
export function saveKits(k: Kit[]): void {
  write(K_KITS, k);
}
/** The kit a bought line names (same name), if any. */
export function kitMatch(name: string): Kit | null {
  const k = key(name);
  return k ? getKits().find((x) => key(x.name) === k) ?? null : null;
}

// ── Stocktakes ─────────────────────────────────────────────────────────────────
/** A stocktake («الجرد»): the counted quantity of each item against what was recorded. */
export interface StockCount { id: string; at: number; lines: { stockId: string; name: string; before: number; counted: number }[] }
const K_COUNTS = "station.stockCounts.v1";
export function getCounts(): StockCount[] {
  return read<StockCount[]>(K_COUNTS, []);
}
/** Set the counted items to what was found on the shelf, keep the stocktake (the last 50), and
 *  record the differences in «سجل الحركة». Returns the saved stocktake. */
export function applyCount(counted: Record<string, number>): StockCount | null {
  const stock = getStock();
  const lines = stock.filter((s) => counted[s.id] != null && Number.isFinite(counted[s.id]))
    .map((s) => ({ stockId: s.id, name: s.name, before: Number(s.qty) || 0, counted: counted[s.id] }));
  if (!lines.length) return null;
  const rec: StockCount = { id: uid(), at: Date.now(), lines };
  saveStock(stock.map((s) => (counted[s.id] != null && Number.isFinite(counted[s.id]) ? { ...s, qty: counted[s.id] } : s)), "count", `جرد ${new Date(rec.at).toLocaleDateString("en-CA")}`);
  write(K_COUNTS, [rec, ...getCounts()].slice(0, 50));
  return rec;
}

// ── Payments (supplier debts) ────────────────────────────────────────────────
/** Paid so far: the payments, or the whole total for a purchase marked paid without them. */
export const paidOf = (p: Purchase): number =>
  p.payments?.length ? p.payments.reduce((t, x) => t + (Number(x.amount) || 0), 0) : p.paid ? Number(p.total) || 0 : 0;
export const dueOf = (p: Purchase): number => p.ordered ? 0 : Math.max(0, (Number(p.total) || 0) - paidOf(p));
/** Record a payment; the purchase counts as paid once they cover its total. */
export function addPayment(purchaseId: string, amount: number, note?: string): void {
  const all = getPurchases();
  write(K_PUR, all.map((p) => {
    if (p.id !== purchaseId || !(amount > 0)) return p;
    // A purchase marked paid before payments were kept starts from its whole total.
    const base = p.payments?.length ? p.payments : p.paid ? [{ id: uid(), date: p.date, amount: Number(p.total) || 0 }] : [];
    const payments = [...base, { id: uid(), date: new Date().toLocaleDateString("en-CA"), amount, ...(note ? { note } : {}) }];
    const next = { ...p, payments };
    return { ...next, paid: dueOf(next) <= 0 };
  }));
}

/** «تم الدفع» / «غير مدفوعة»: mark a purchase paid (with supplier debts on, what was still owed is
 *  recorded as a payment) or back to unpaid (its payments are cleared). */
export function setPaid(purchaseId: string, paid: boolean): void {
  const p = getPurchases().find((x) => x.id === purchaseId);
  if (!p) return;
  if (paid && getSettings().debts && dueOf(p) > 0) { addPayment(purchaseId, dueOf(p)); return; }
  write(K_PUR, getPurchases().map((x) => (x.id === purchaseId ? { ...x, paid, ...(paid ? {} : { payments: undefined }) } : x)));
}

// ── Purchases ────────────────────────────────────────────────────────────────
export function getPurchases(): Purchase[] {
  return read<Purchase[]>(K_PUR, []);
}
export function savePurchases(p: Purchase[]): void {
  write(K_PUR, p);
}
export function addPurchase(p: Purchase): boolean {
  return write(K_PUR, [p, ...getPurchases()]);
}
export function updatePurchase(p: Purchase): void {
  write(K_PUR, getPurchases().map((x) => (x.id === p.id ? p : x)));
}
export function deletePurchases(ids: string[]): void {
  const set = new Set(ids);
  const all = getPurchases();
  const back = all.filter((p) => set.has(p.id)).flatMap((p) => p.stockAdded ?? []);
  write(K_PUR, all.filter((p) => !set.has(p.id)));
  if (back.length) changeStock(back.map((b) => ({ id: b.id, qty: -b.qty })), "purchase-del");
}

// ── Stock room link ──────────────────────────────────────────────────────────
/** The stock item a bought line refers to (same name), if any. */
export function stockMatch(name: string): { id: string; name: string; qty: number } | null {
  const k = key(name);
  if (!k) return null;
  return getStock().find((s) => key(s.name) === k) ?? null;
}
function changeStock(moves: { id: string; qty: number }[], reason: "purchase" | "purchase-del", ref?: string, prices?: Map<string, number>): void {
  const by = new Map<string, number>();
  for (const m of moves) by.set(m.id, (by.get(m.id) ?? 0) + m.qty);
  saveStock(getStock().map((s) => (by.has(s.id)
    ? { ...s, qty: stockFloor(Number(s.qty) + by.get(s.id)!), ...(prices?.has(s.id) ? { price: prices.get(s.id) } : {}) }
    : s)), reason, ref);
}
/** Put bought quantities in the stock room: onto the item of the same name, or as a new item
 *  (with no quantity yet, then the purchase's); a kit's parts, each times the kits bought. The
 *  item's unit price follows the purchase (a kit's, when it holds one item). Returns what was added. */
export function addToStock(items: PurchaseItem[], ref?: string): { id: string; qty: number }[] {
  const lines = items.map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 0, price: Number(it.unitPrice) || 0, kitId: it.kitId, expiry: it.expiry, lot: it.lot, gtin: it.gtin, device: it.device?.trim() }))
    .filter((x) => x.name && x.qty > 0);
  if (!lines.length) return [];
  const stock = getStock();
  const kits = getKits();
  const fresh: typeof stock = [];
  const prices = new Map<string, number>();
  // The batch's expiry and lot on the item: the nearest expiry is the one to watch.
  const batch = new Map<string, { expiry?: string; lot?: string }>();
  const note = (id: string, x: { expiry?: string; lot?: string }) => {
    if (!x.expiry && !x.lot) return;
    const b = batch.get(id) ?? {};
    batch.set(id, { expiry: x.expiry && (!b.expiry || x.expiry < b.expiry) ? x.expiry : b.expiry, lot: x.lot || b.lot });
  };
  // A scanned GS1 code becomes the barcode of the item or kit that has none, for the next scan.
  const codes = new Map<string, string>();
  const devices = new Map<string, string>();
  const kitCodes = new Map<string, string>();
  const added = lines.flatMap((x) => {
    // Only a line bought as a kit is opened into its contents.
    const kit = x.kitId ? kits.find((k) => k.id === x.kitId) ?? kits.find((k) => key(k.name) === key(x.name)) : undefined;
    if (kit) {
      const parts = kit.parts.filter((p) => stock.some((s) => s.id === p.stockId) && p.qty > 0);
      if (parts.length === 1 && x.price > 0) prices.set(parts[0].stockId, Math.round((x.price / parts[0].qty) * 100) / 100);
      for (const p of parts) note(p.stockId, x);
      if (x.gtin && !kit.barcode) kitCodes.set(kit.id, x.gtin);
      return parts.map((p) => ({ id: p.stockId, qty: p.qty * x.qty }));
    }
    let item = stock.find((s) => key(s.name) === key(x.name)) ?? fresh.find((s) => key(s.name) === key(x.name));
    if (!item) { item = { id: uid(), name: x.name, qty: 0 }; fresh.push(item); }
    if (x.price > 0) prices.set(item.id, x.price);
    note(item.id, x);
    if (x.gtin && !item.barcode) codes.set(item.id, x.gtin);
    if (x.device && !item.device) devices.set(item.id, x.device);
    return [{ id: item.id, qty: x.qty }];
  });
  if (fresh.length) saveStock([...stock, ...fresh]);
  changeStock(added, "purchase", ref, prices);
  if (kitCodes.size) saveKits(kits.map((k) => (kitCodes.has(k.id) ? { ...k, barcode: kitCodes.get(k.id) } : k)));
  if (codes.size || devices.size) saveStock(getStock().map((s) => (codes.has(s.id) || devices.has(s.id)
    ? { ...s, ...(codes.has(s.id) ? { barcode: codes.get(s.id) } : {}), ...(devices.has(s.id) ? { device: devices.get(s.id) } : {}) } : s)), "edit", ref);
  if (batch.size) {
    saveStock(getStock().map((s) => {
      const b = batch.get(s.id);
      if (!b) return s;
      // Stock left from before keeps its expiry when it comes sooner; otherwise the new batch's.
      const before = Number(s.qty) - added.filter((a) => a.id === s.id).reduce((t, a) => t + a.qty, 0);
      const expiry = b.expiry && (!s.expiry || before <= 0 || b.expiry < s.expiry) ? b.expiry : s.expiry;
      return { ...s, ...(expiry ? { expiry } : {}), ...(b.lot ? { lot: b.lot } : {}) };
    }), "edit", ref);
  }
  return added;
}
/** An ordered purchase arrived: its date becomes today's and its lines go into the stock room.
 *  Returns how many stock items were added to. */
export function receivePurchase(id: string): number {
  const p = getPurchase(id);
  if (!p || !p.ordered) return 0;
  const date = new Date().toLocaleDateString("en-CA");
  const added = addToStock(p.items, [p.supplierName, date].filter(Boolean).join(" · "));
  updatePurchase({ ...p, ordered: false, date, ...(added.length ? { stockAdded: added } : {}) });
  return added.length;
}
export function getPurchase(id: string): Purchase | null {
  return getPurchases().find((p) => p.id === id) ?? null;
}

/** Device names offered on a purchase line: those on the stock items and the quality station's
 *  devices (read as they are, without seeding them). */
export function deviceNames(): string[] {
  const qc = read<{ name?: string }[]>("qc.devices.v1", []);
  const names = [...getStock().map((s) => s.device ?? ""), ...(Array.isArray(qc) ? qc.map((d) => d?.name ?? "") : [])].map((n) => n.trim()).filter(Boolean);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): PurchasingSettings {
  const s = read<PurchasingSettings>(K_SET, { orgName: "المخزن والمشتريات" });
  // The station's old name, kept by labs that never changed it.
  return s.orgName === "منظومة المشتريات" ? { ...s, orgName: "المخزن والمشتريات" } : s;
}
export function saveSettings(s: PurchasingSettings): void {
  write(K_SET, s);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
/** A line's total: as typed, or qty × unit price for older lines. */
export function lineTotal(it: PurchaseItem): number {
  return it.total != null ? Number(it.total) || 0 : Number(it.qty || 0) * Number(it.unitPrice || 0);
}
export function purchaseTotal(items: PurchaseItem[]): number {
  return items.reduce((s, it) => s + lineTotal(it), 0);
}

// ── Backup ───────────────────────────────────────────────────────────────────
export interface PurchasingBackup {
  app: "spir-purchasing";
  version: 1;
  exported_at: string;
  suppliers: Supplier[];
  purchases: Purchase[];
  settings: PurchasingSettings;
  /** The stock room (shared with the lab station on this device). */
  stock?: ReturnType<typeof getStock>;
  kits?: Kit[];
  counts?: StockCount[];
}
export function exportBackup(): PurchasingBackup {
  return {
    app: "spir-purchasing",
    version: 1,
    exported_at: new Date().toISOString(),
    suppliers: getSuppliers(),
    purchases: getPurchases(),
    settings: getSettings(),
    stock: getStock(),
    kits: getKits(),
    counts: getCounts(),
  };
}
export function importBackup(data: unknown): boolean {
  try {
    const b = data as Partial<PurchasingBackup>;
    if (!b || b.app !== "spir-purchasing" || !Array.isArray(b.purchases)) return false;
    if (b.suppliers) write(K_SUP, b.suppliers);
    if (b.purchases) write(K_PUR, b.purchases);
    if (b.settings) write(K_SET, b.settings);
    if (Array.isArray(b.stock)) saveStock(b.stock, "edit", "استعادة نسخة احتياطية");
    if (Array.isArray(b.kits)) write(K_KITS, b.kits);
    if (Array.isArray(b.counts)) write(K_COUNTS, b.counts);
    return true;
  } catch {
    return false;
  }
}
