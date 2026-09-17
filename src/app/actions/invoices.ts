"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { logAudit } from "@/lib/audit";

function invoiceNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INV-${ymd}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}

/** Recompute totals + paid + status from the invoice's items and payments. */
async function recompute(invoiceId: string): Promise<void> {
  const inv = await queryOne<any>(
    `select discount, tax_rate, order_id from invoices where id = $1`,
    [invoiceId]
  );
  if (!inv) return;
  const sub = (await queryOne<{ s: number }>(
    `select coalesce(sum(amount),0) as s from invoice_items where invoice_id = $1`,
    [invoiceId]
  ))!.s;
  const paid = (await queryOne<{ s: number }>(
    `select coalesce(sum(amount),0) as s from payments where invoice_id = $1`,
    [invoiceId]
  ))!.s;
  const discount = Number(inv.discount || 0);
  const taxable = Math.max(0, Number(sub) - discount);
  const taxAmount = (taxable * Number(inv.tax_rate || 0)) / 100;
  const total = taxable + taxAmount;
  let status = "unpaid";
  if (Number(paid) >= total && total > 0) status = "paid";
  else if (Number(paid) > 0) status = "partial";
  await query(
    `update invoices set subtotal=$1, tax_amount=$2, total=$3, paid=$4,
        status = case when status='void' then 'void' else $5 end
      where id=$6`,
    [sub, taxAmount, total, paid, status, invoiceId]
  );

  // Keep the order's quick-glance payment status in step with its invoice, so
  // reception/lab/release desks see one consistent figure. Also mirror the
  // payment method from the most recent payment.
  if (inv.order_id) {
    const lastMethod = (await queryOne<{ method: string | null }>(
      `select method from payments where invoice_id = $1 order by paid_at desc limit 1`,
      [invoiceId]
    ))?.method ?? null;
    await query(
      `update test_orders set payment_status = $1,
          payment_method = case when $1 = 'unpaid' then null else $2 end
        where id = $3`,
      [status, lastMethod, inv.order_id]
    );
    revalidatePath(`/orders/${inv.order_id}`);
    revalidatePath("/release");
  }
}

/** Raise an invoice from a test order (lines = ordered tests). */
export async function createInvoiceFromOrder(orderId: string): Promise<void> {
  const existing = await queryOne<{ id: string }>(
    `select id from invoices where order_id = $1 and status <> 'void' limit 1`,
    [orderId]
  );
  if (existing) redirect(`/invoices/${existing.id}`);

  const order = await queryOne<any>(
    `select patient_id, payment_status, payment_method from test_orders where id = $1`,
    [orderId]
  );
  if (!order) return;

  const items = await query<any>(
    `select t.name_ar, i.price
       from test_order_items i join test_catalog t on t.id = i.test_id
      where i.order_id = $1`,
    [orderId]
  );

  const inv = await queryOne<{ id: string }>(
    `insert into invoices (invoice_no, order_id, patient_id) values ($1,$2,$3) returning id`,
    [invoiceNo(), orderId, order.patient_id]
  );
  const invoiceId = inv!.id;
  for (const it of items) {
    await query(
      `insert into invoice_items (invoice_id, description, quantity, unit_price, amount)
       values ($1,$2,1,$3,$3)`,
      [invoiceId, it.name_ar, Number(it.price || 0)]
    );
  }
  await recompute(invoiceId);

  // If reception already collected the full amount via quick-pay, carry it over
  // as a real payment so switching to an invoice does not lose that money.
  if (order.payment_status === "paid") {
    const total = (await queryOne<{ total: number }>(
      `select total from invoices where id = $1`,
      [invoiceId]
    ))?.total;
    if (Number(total) > 0) {
      await query(
        `insert into payments (invoice_id, amount, method) values ($1,$2,$3)`,
        [invoiceId, Number(total), order.payment_method || "cash"]
      );
      await recompute(invoiceId);
    }
  }
  await logAudit("invoice.created", "invoice", invoiceId, { order_id: orderId });
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function updateInvoiceTerms(formData: FormData): Promise<void> {
  const id = String(formData.get("invoice_id") || "");
  if (!id) return;
  await query(`update invoices set discount=$1, tax_rate=$2, notes=$3 where id=$4`, [
    Number(formData.get("discount") || 0),
    Number(formData.get("tax_rate") || 0),
    (formData.get("notes") as string) || null,
    id,
  ]);
  await recompute(id);
  revalidatePath(`/invoices/${id}`);
}

export async function recordPayment(formData: FormData): Promise<void> {
  const id = String(formData.get("invoice_id") || "");
  const amount = Number(formData.get("amount") || 0);
  if (!id || !amount) return;
  await query(
    `insert into payments (invoice_id, amount, method) values ($1,$2,$3)`,
    [id, amount, (formData.get("method") as string) || "cash"]
  );
  await recompute(id);
  await logAudit("payment.recorded", "invoice", id, { amount });
  revalidatePath(`/invoices/${id}`);
}

export async function voidInvoice(formData: FormData): Promise<void> {
  const id = String(formData.get("invoice_id") || "");
  if (!id) return;
  await query(`update invoices set status='void' where id=$1`, [id]);
  await logAudit("invoice.void", "invoice", id, {});
  revalidatePath(`/invoices/${id}`);
}
