"use server";

import { hasRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

export async function addReagent(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return; // the role's pages only (see lib/nav.ts)
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await query(
    `insert into products (name, unit, quantity, min_quantity, expiry_date, buy_price)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      name,
      (formData.get("unit") as string) || "test",
      Number(formData.get("quantity") || 0),
      Number(formData.get("min_quantity") || 7),
      (formData.get("expiry_date") as string) || null,
      Number(formData.get("buy_price") || 0),
    ]
  );
  revalidatePath("/inventory");
}

/** Restock: add quantity and log a stock movement. */
export async function restock(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return; // the role's pages only (see lib/nav.ts)
  const productId = String(formData.get("product_id") || "");
  const amount = Number(formData.get("amount") || 0);
  if (!productId || !amount) return;
  await query(`update products set quantity = quantity + $1 where id = $2`, [
    amount,
    productId,
  ]);
  await query(
    `insert into stock_movements (product_id, change_qty, reason)
     values ($1, $2, 'purchase')`,
    [productId, amount]
  );
  revalidatePath("/inventory");
}
