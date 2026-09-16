"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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
