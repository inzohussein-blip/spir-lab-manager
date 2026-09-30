"use client";

/**
 * Local, offline-first store for the Purchasing app. Everything lives in this browser's
 * storage (lib/local/kv — single machine, no database). Its stock room is the lab station's
 * (station.stock.v1): purchases add to it and the lab station deducts from it.
 */

import { kvGet, kvSet } from "@/lib/local/kv";
import { getStock, saveStock } from "@/lib/station/store";

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  note?: string;
}

export interface PurchaseItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface Purchase {
  id: string;
  created_at: number;
  date: string; // YYYY-MM-DD
  supplierId?: string;
  supplierName?: string;
  items: PurchaseItem[];
  total: number;
  paid: boolean;
  notes?: string;
  /** Quantities this purchase added to the stock room (taken back if it is deleted). */
  stockAdded?: { id: string; qty: number }[];
}

export interface PurchasingSettings {
  orgName: string;
  subtitle?: string;
  footer?: string;
  /** Letterhead logo (image data URL); empty → the default logo. */
  logo?: string;
}

const K_SUP = "purchasing.suppliers.v1";
const K_PUR = "purchasing.purchases.v1";
const K_SET = "purchasing.settings.v1";

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

// ── Suppliers ────────────────────────────────────────────────────────────────
export function getSuppliers(): Supplier[] {
  return read<Supplier[]>(K_SUP, []);
}
export function saveSuppliers(s: Supplier[]): void {
  write(K_SUP, s);
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
  if (back.length) changeStock(back.map((b) => ({ id: b.id, qty: -b.qty })));
}

// ── Stock room link ──────────────────────────────────────────────────────────
const key = (s: string) => s.trim().toLowerCase();
/** The stock item a bought line refers to (same name), if any. */
export function stockMatch(name: string): { id: string; name: string; qty: number } | null {
  const k = key(name);
  if (!k) return null;
  return getStock().find((s) => key(s.name) === k) ?? null;
}
function changeStock(moves: { id: string; qty: number }[]): void {
  const by = new Map<string, number>();
  for (const m of moves) by.set(m.id, (by.get(m.id) ?? 0) + m.qty);
  saveStock(getStock().map((s) => (by.has(s.id) ? { ...s, qty: Math.max(0, Number(s.qty) + by.get(s.id)!) } : s)));
}
/** Add bought quantities to the matching stock items; returns what was added. */
export function addToStock(items: PurchaseItem[]): { id: string; qty: number }[] {
  const added = items
    .map((it) => ({ m: stockMatch(it.name), qty: Number(it.qty) || 0 }))
    .filter((x): x is { m: NonNullable<typeof x.m>; qty: number } => !!x.m && x.qty > 0)
    .map((x) => ({ id: x.m.id, qty: x.qty }));
  if (added.length) changeStock(added);
  return added;
}
export function getPurchase(id: string): Purchase | null {
  return getPurchases().find((p) => p.id === id) ?? null;
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): PurchasingSettings {
  return read<PurchasingSettings>(K_SET, { orgName: "منظومة المشتريات" });
}
export function saveSettings(s: PurchasingSettings): void {
  write(K_SET, s);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function purchaseTotal(items: PurchaseItem[]): number {
  return items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unitPrice || 0), 0);
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
  };
}
export function importBackup(data: unknown): boolean {
  try {
    const b = data as Partial<PurchasingBackup>;
    if (!b || b.app !== "spir-purchasing" || !Array.isArray(b.purchases)) return false;
    if (b.suppliers) write(K_SUP, b.suppliers);
    if (b.purchases) write(K_PUR, b.purchases);
    if (b.settings) write(K_SET, b.settings);
    if (Array.isArray(b.stock)) saveStock(b.stock);
    return true;
  } catch {
    return false;
  }
}
