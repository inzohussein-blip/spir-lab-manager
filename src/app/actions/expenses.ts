"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

export async function addExpense(formData: FormData): Promise<void> {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  await query(
    `insert into expenses (title, amount, spent_on, category)
     values ($1, $2, coalesce($3, current_date), $4)`,
    [
      title,
      Number(formData.get("amount") || 0),
      (formData.get("spent_on") as string) || null,
      (formData.get("category") as string) || null,
    ]
  );
  revalidatePath("/orders-expenses");
}

export async function addSupplier(formData: FormData): Promise<void> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await query(`insert into suppliers (name, phone) values ($1, $2)`, [
    name,
    (formData.get("phone") as string) || null,
  ]);
  revalidatePath("/orders-expenses");
}

export async function addPurchaseOrder(formData: FormData): Promise<void> {
  const supplierId = (formData.get("supplier_id") as string) || null;
  const total = Number(formData.get("total_amount") || 0);
  await query(
    `insert into purchase_orders (supplier_id, order_date, total_amount, notes)
     values ($1, coalesce($2, current_date), $3, $4)`,
    [
      supplierId,
      (formData.get("order_date") as string) || null,
      total,
      (formData.get("notes") as string) || null,
    ]
  );
  revalidatePath("/orders-expenses");
}
