"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Line = { product_id?: string; description?: string; quantity: number; unit_price: number };

/** Create a purchase order with line items. Lines arrive as a JSON string. */
export async function createPurchaseOrder(formData: FormData): Promise<void> {
  const supplierId = (formData.get("supplier_id") as string) || null;
  let lines: Line[] = [];
  try {
    lines = JSON.parse(String(formData.get("lines") || "[]"));
  } catch {
    lines = [];
  }
  lines = lines.filter((l) => (l.product_id || l.description) && Number(l.quantity) > 0);
  if (lines.length === 0) return;

  const total = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price || 0), 0);
  const po = await queryOne<{ id: string }>(
    `insert into purchase_orders (supplier_id, total_amount, notes, reference, status)
     values ($1, $2, $3, $4, 'ordered') returning id`,
    [
      supplierId,
      total,
      (formData.get("notes") as string) || null,
      (formData.get("reference") as string) || null,
    ]
  );
  const poId = po!.id;
  for (const l of lines) {
    await query(
      `insert into purchase_order_items (order_id, product_id, description, quantity, unit_price)
       values ($1,$2,$3,$4,$5)`,
      [
        poId,
        l.product_id || null,
        l.description || null,
        Number(l.quantity),
        Number(l.unit_price || 0),
      ]
    );
  }
  await logAudit("po.created", "purchase_order", poId, { lines: lines.length, total });
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${poId}`);
}

/** Receive a purchase order: increment stock for each product line + log
 *  movements, then mark received. */
export async function receivePurchaseOrder(formData: FormData): Promise<void> {
  const poId = String(formData.get("po_id") || "");
  if (!poId) return;
  const po = await queryOne<any>(`select status from purchase_orders where id = $1`, [poId]);
  if (!po || po.status === "received" || po.status === "cancelled") return;

  const lines = await query<any>(
    `select product_id, quantity from purchase_order_items where order_id = $1 and product_id is not null`,
    [poId]
  );
  for (const l of lines) {
    await query(`update products set quantity = quantity + $1 where id = $2`, [
      Number(l.quantity),
      l.product_id,
    ]);
    await query(
      `insert into stock_movements (product_id, change_qty, reason, ref_table, ref_id)
       values ($1, $2, 'purchase', 'purchase_orders', $3)`,
      [l.product_id, Number(l.quantity), poId]
    );
  }
  await query(
    `update purchase_orders set status = 'received', received_at = now() where id = $1`,
    [poId]
  );
  await logAudit("po.received", "purchase_order", poId, { lines: lines.length });
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/inventory");
}

export async function cancelPurchaseOrder(formData: FormData): Promise<void> {
  const poId = String(formData.get("po_id") || "");
  if (!poId) return;
  await query(`update purchase_orders set status = 'cancelled' where id = $1 and status <> 'received'`, [poId]);
  await logAudit("po.cancelled", "purchase_order", poId, {});
  revalidatePath(`/purchase-orders/${poId}`);
}
