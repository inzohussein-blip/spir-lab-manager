"use server";

import { query, queryOne } from "@/lib/db";
import { cloudApiConfigured, sendCloudMessage, waLink } from "@/lib/whatsapp";

/**
 * Send an order's report link to the patient over WhatsApp and log it.
 * Uses the official Cloud API when configured; otherwise returns a wa.me link
 * for the operator to open.
 */
export async function sendReportWhatsApp(
  orderId: string
): Promise<{ ok: boolean; link?: string; error?: string; via: string }> {
  const row = await queryOne<any>(
    `select o.patient_id, p.full_name, p.phone,
            (select qr_token from reports where order_id = o.id limit 1) as token
       from test_orders o join patients p on p.id = o.patient_id
      where o.id = $1`,
    [orderId]
  );
  if (!row) return { ok: false, error: "الطلب غير موجود", via: "none" };
  if (!row.phone)
    return { ok: false, error: "لا يوجد رقم هاتف للمريض", via: "none" };

  const message = `نتائج فحص ${row.full_name} — مختبر التحاليل الطبية.${
    row.token ? ` رمز التحقق: ${row.token}` : ""
  }`;

  if (cloudApiConfigured()) {
    const res = await sendCloudMessage(row.phone, message);
    await query(
      `insert into whatsapp_log (patient_id, order_id, phone, channel, status)
       values ($1, $2, $3, 'cloud_api', $4)`,
      [row.patient_id, orderId, row.phone, res.ok ? "sent" : "failed"]
    );
    return res.ok
      ? { ok: true, via: "cloud_api" }
      : { ok: false, error: res.error, via: "cloud_api" };
  }

  // MVP fallback: wa.me link.
  const link = waLink(row.phone, message);
  await query(
    `insert into whatsapp_log (patient_id, order_id, phone, channel, status)
     values ($1, $2, $3, 'wa_link', 'queued')`,
    [row.patient_id, orderId, row.phone]
  );
  return { ok: true, link, via: "wa_link" };
}
