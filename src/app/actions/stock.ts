"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasRole } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ensureOps } from "@/lib/desk/schema";

/** Manual stock adjustment (+/-) with a reason; logs a movement + audit. */
export async function adjustStock(formData: FormData): Promise<void> {
  const productId = String(formData.get("product_id") || "");
  const delta = Number(formData.get("delta") || 0);
  const reason = String(formData.get("reason") || "adjustment");
  if (!productId || !delta) return;
  await query(`update products set quantity = quantity + $1 where id = $2`, [delta, productId]);
  await query(
    `insert into stock_movements (product_id, change_qty, reason) values ($1, $2, $3)`,
    [productId, delta, reason]
  );
  await logAudit("stock.adjust", "product", productId, { delta, reason });
  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
}

/** Reconciliation: set the physically counted quantity; records the variance
 *  as a movement so the ledger stays truthful. */
export async function reconcileStock(formData: FormData): Promise<void> {
  const productId = String(formData.get("product_id") || "");
  const counted = Number(formData.get("counted") || 0);
  if (!productId) return;
  const cur = await query<{ quantity: number }>(
    `select quantity from products where id = $1`,
    [productId]
  );
  if (!cur[0]) return;
  const delta = counted - Number(cur[0].quantity);
  if (delta === 0) return;
  await query(`update products set quantity = $1 where id = $2`, [counted, productId]);
  await query(
    `insert into stock_movements (product_id, change_qty, reason) values ($1, $2, 'reconcile')`,
    [productId, delta]
  );
  await logAudit("stock.reconcile", "product", productId, { counted, variance: delta });
  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
}

// ── Full stocktake, kits (migration 0031) ─────────────────────────────────────────────
/** «الجرد»: every counted item at once; each difference is booked as a movement, and the count kept. */
export async function saveStocktake(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return;
  await ensureOps();
  const products = await query<{ id: string; quantity: number }>(`select id, quantity from products where is_active`);
  const lines: { id: string; expected: number; counted: number }[] = [];
  for (const p of products) {
    const raw = String(formData.get(`c_${p.id}`) ?? "").trim();
    if (raw === "" || !Number.isFinite(Number(raw))) continue;
    lines.push({ id: p.id, expected: Number(p.quantity), counted: Number(raw) });
  }
  if (!lines.length) return;
  const user = await getCurrentUser();
  const diffs = lines.filter((l) => l.counted !== l.expected).length;
  const c = await queryOne<{ id: string }>(`insert into stock_counts (by_name, note, items, diffs) values ($1, $2, $3, $4) returning id`, [
    user?.full_name ?? null, (formData.get("note") as string)?.trim() || null, lines.length, diffs,
  ]);
  for (const l of lines) {
    await query(`insert into stock_count_lines (count_id, product_id, expected, counted) values ($1, $2, $3, $4)`, [c!.id, l.id, l.expected, l.counted]);
    if (l.counted === l.expected) continue;
    await query(`update products set quantity = $1 where id = $2`, [l.counted, l.id]);
    await query(`insert into stock_movements (product_id, change_qty, reason, ref_table, ref_id) values ($1, $2, 'stocktake', 'stock_counts', $3)`, [l.id, l.counted - l.expected, c!.id]);
  }
  await logAudit("stock.count", "stock_count", c!.id, { items: lines.length, diffs });
  revalidatePath("/inventory");
  revalidatePath("/inventory/count");
}

/** A kit: a pack holding a number of units of one item (e.g. a box of 100 glucose tests). */
export async function addKit(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return;
  await ensureOps();
  const name = String(formData.get("name") || "").trim();
  const productId = String(formData.get("product_id") || "");
  const units = Number(formData.get("units") || 0);
  if (!name || !productId || !(units > 0)) return;
  await query(`insert into stock_kits (name, product_id, units) values ($1, $2, $3)`, [name.slice(0, 120), productId, units]);
  revalidatePath("/inventory/kits");
}

export async function deleteKit(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return;
  await query(`delete from stock_kits where id = $1`, [String(formData.get("id") || "")]);
  revalidatePath("/inventory/kits");
}

/** Kits received: their units added to the item. */
export async function receiveKits(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return;
  await ensureOps();
  const kitId = String(formData.get("kit_id") || "");
  const count = Number(formData.get("count") || 0);
  if (!kitId || !(count > 0)) return;
  const k = await queryOne<{ product_id: string; units: number }>(`select product_id, units from stock_kits where id = $1`, [kitId]);
  if (!k) return;
  const add = count * Number(k.units);
  await query(`update products set quantity = quantity + $1 where id = $2`, [add, k.product_id]);
  await query(`insert into stock_movements (product_id, change_qty, reason, ref_table, ref_id) values ($1, $2, 'kit', 'stock_kits', $3)`, [k.product_id, add, kitId]);
  await logAudit("stock.kit", "product", k.product_id, { kits: count, units: add });
  revalidatePath("/inventory");
  revalidatePath("/inventory/kits");
}
