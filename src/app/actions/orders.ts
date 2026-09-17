"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { logAudit } from "@/lib/audit";

function accessionNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `LAB-${ymd}-${suffix}`;
}

/** Create an order (visit) with the selected tests. Reagent stock is deducted
 *  automatically by the DB trigger on each inserted order item (section 3).
 *  Returns the new order id (no redirect, so it is offline-replayable). */
export async function createOrder(formData: FormData): Promise<{ orderId: string } | null> {
  const patientId = String(formData.get("patient_id") || "");
  const testIds = formData.getAll("test_ids").map(String).filter(Boolean);
  if (!patientId || testIds.length === 0) return null;

  const referrerId = (formData.get("referrer_id") as string) || null;
  const paymentStatusRaw = String(formData.get("payment_status") || "unpaid");
  const paymentStatus = ["unpaid", "paid", "partial"].includes(paymentStatusRaw)
    ? paymentStatusRaw
    : "unpaid";
  const paymentMethodRaw = String(formData.get("payment_method") || "");
  const paymentMethod = ["cash", "card", "transfer"].includes(paymentMethodRaw)
    ? paymentMethodRaw
    : null;
  const order = await queryOne<{ id: string }>(
    `insert into test_orders
       (patient_id, status, accession_no, referrer_id, payment_status, payment_method)
     values ($1, 'in_progress', $2, $3, $4, $5) returning id`,
    [patientId, accessionNo(), referrerId, paymentStatus, paymentMethod]
  );
  const orderId = order!.id;

  let total = 0;
  for (const testId of testIds) {
    const t = await queryOne<{ price: number }>(
      `select price from test_catalog where id = $1`,
      [testId]
    );
    const price = Number(t?.price ?? 0);
    total += price;
    await query(
      `insert into test_order_items (order_id, test_id, price) values ($1, $2, $3)`,
      [orderId, testId, price]
    );
  }
  await query(`update test_orders set total_amount = $1 where id = $2`, [
    total,
    orderId,
  ]);

  await logAudit("order.created", "order", orderId, {
    tests: testIds.length,
    total,
    payment: paymentStatus,
  });

  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/orders");
  return { orderId };
}

/** Save (upsert) a single test result. Flag H/L/N is computed by a DB trigger. */
export async function saveResult(formData: FormData): Promise<void> {
  const orderItemId = String(formData.get("order_item_id") || "");
  const orderId = String(formData.get("order_id") || "");
  const patientId = String(formData.get("patient_id") || "");
  const testId = String(formData.get("test_id") || "");
  if (!orderItemId) return;

  const valueNumericRaw = formData.get("value_numeric");
  const valueNumeric =
    valueNumericRaw && String(valueNumericRaw).trim() !== ""
      ? Number(valueNumericRaw)
      : null;
  const valueText = (formData.get("value_text") as string) || null;

  // Special panels (Urine/Stool): physical + microscopic findings.
  const physical = {
    color: (formData.get("phys_color") as string) || null,
    appearance: (formData.get("phys_appearance") as string) || null,
    sediment: (formData.get("phys_sediment") as string) || null,
  };
  const micro = {
    rbc: (formData.get("mic_rbc") as string) || null,
    pus_cells: (formData.get("mic_pus") as string) || null,
    epithelial: (formData.get("mic_epithelial") as string) || null,
    crystals: (formData.get("mic_crystals") as string) || null,
    mucus: (formData.get("mic_mucus") as string) || null,
  };
  const hasPhysical = Object.values(physical).some(Boolean);
  const hasMicro = Object.values(micro).some(Boolean);

  await query(`delete from test_results where order_item_id = $1`, [orderItemId]);
  await query(
    `insert into test_results
       (order_item_id, order_id, patient_id, test_id, value_numeric, value_text,
        physical_inspection, microscopic)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      orderItemId,
      orderId,
      patientId,
      testId,
      valueNumeric,
      valueText,
      hasPhysical ? JSON.stringify(physical) : null,
      hasMicro ? JSON.stringify(micro) : null,
    ]
  );

  await logAudit("result.saved", "result", orderItemId, {
    order_id: orderId,
    test_id: testId,
    value: valueNumeric ?? valueText ?? "panel",
  });

  revalidatePath(`/orders/${orderId}`);
}

/** Quick payment update from the reception/release desk — records how the
 *  visit was paid on the order itself, without opening a full invoice. */
export async function setOrderPayment(formData: FormData): Promise<void> {
  const orderId = String(formData.get("order_id") || "");
  const statusRaw = String(formData.get("payment_status") || "");
  const status = ["unpaid", "paid", "partial"].includes(statusRaw) ? statusRaw : null;
  if (!orderId || !status) return;
  const methodRaw = String(formData.get("payment_method") || "");
  const method = ["cash", "card", "transfer"].includes(methodRaw) ? methodRaw : null;

  await query(
    `update test_orders set payment_status = $1, payment_method = $2 where id = $3`,
    [status, status === "unpaid" ? null : method, orderId]
  );
  await logAudit("order.payment", "order", orderId, { status, method });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/release");
}

/** Mark an order status (e.g. completed / delivered). */
export async function setOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get("order_id") || "");
  const status = String(formData.get("status") || "");
  if (!orderId || !status) return;
  await query(`update test_orders set status = $1 where id = $2`, [
    status,
    orderId,
  ]);
  await logAudit("order.status", "order", orderId, { status });
  revalidatePath(`/orders/${orderId}`);
}
