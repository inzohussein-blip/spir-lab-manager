"use client";

/**
 * Local, offline-first store for the standalone Purchasing app — a separate
 * system with no link to the lab admin panel or the lab station. Everything
 * lives in this browser's localStorage (single machine, no database).
 */

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
}

export interface PurchasingSettings {
  orgName: string;
}

const K_SUP = "purchasing.suppliers.v1";
const K_PUR = "purchasing.purchases.v1";
const K_SET = "purchasing.settings.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
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
export function addPurchase(p: Purchase): void {
  write(K_PUR, [p, ...getPurchases()]);
}
export function updatePurchase(p: Purchase): void {
  write(K_PUR, getPurchases().map((x) => (x.id === p.id ? p : x)));
}
export function deletePurchases(ids: string[]): void {
  const set = new Set(ids);
  write(K_PUR, getPurchases().filter((p) => !set.has(p.id)));
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
}
export function exportBackup(): PurchasingBackup {
  return {
    app: "spir-purchasing",
    version: 1,
    exported_at: new Date().toISOString(),
    suppliers: getSuppliers(),
    purchases: getPurchases(),
    settings: getSettings(),
  };
}
export function importBackup(data: unknown): boolean {
  try {
    const b = data as Partial<PurchasingBackup>;
    if (!b || b.app !== "spir-purchasing" || !Array.isArray(b.purchases)) return false;
    if (b.suppliers) write(K_SUP, b.suppliers);
    if (b.purchases) write(K_PUR, b.purchases);
    if (b.settings) write(K_SET, b.settings);
    return true;
  } catch {
    return false;
  }
}
