import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { query, queryOne } from "@/lib/db";
import { PrintButton } from "@/components/PrintButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { FlagChip } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Ensure a stable QR token exists for this order's report. */
async function getReportToken(orderId: string, patientId: string) {
  const existing = await queryOne<{ qr_token: string }>(
    `select qr_token from reports where order_id = $1 limit 1`,
    [orderId]
  );
  if (existing) return existing.qr_token;
  const created = await queryOne<{ qr_token: string }>(
    `insert into reports (order_id, patient_id) values ($1, $2) returning qr_token`,
    [orderId, patientId]
  );
  return created!.qr_token;
}

export default async function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await queryOne<any>(
    `select o.*, p.full_name, p.gender, p.age_years, p.phone
       from test_orders o join patients p on p.id = o.patient_id
      where o.id = $1`,
    [params.id]
  );
  if (!order) notFound();

  const items = await query<any>(
    `select t.name_ar, t.name_en, t.unit, t.normal_low, t.normal_high, t.is_special,
            r.value_numeric, r.value_text, r.flag, r.physical_inspection, r.microscopic
       from test_order_items i
       join test_catalog t on t.id = i.test_id
       left join test_results r on r.order_item_id = i.id
      where i.order_id = $1 order by t.name_ar`,
    [params.id]
  );

  const token = await getReportToken(order.id, order.patient_id);
  // Encode the absolute verification URL so scanning the QR opens the public
  // /verify page (section 8: online report authenticity check).
  const h = headers();
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (h.get("x-forwarded-host") || h.get("host")
      ? `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`
      : "");
  const verifyUrl = `${base}/verify/${token}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });

  return (
    <div>
      <div className="no-print mb-4 flex gap-2">
        <PrintButton />
        {order.phone && <WhatsAppButton orderId={order.id} />}
      </div>

      {/* A4 report sheet */}
      <div className="mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-teal-700 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-teal-800">مختبر التحاليل الطبية</h1>
            <p className="text-sm text-gray-600">تقرير نتائج الفحوصات</p>
          </div>
          <img src={qr} alt="QR" width={90} height={90} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><b>المريض:</b> {order.full_name}</div>
          <div><b>التاريخ:</b> {order.order_date}</div>
          <div>
            <b>الجنس:</b>{" "}
            {order.gender === "male" ? "ذكر" : order.gender === "female" ? "أنثى" : "—"}
          </div>
          <div><b>العمر:</b> {order.age_years ?? "—"}</div>
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-right">
              <th className="py-2">الفحص</th>
              <th className="py-2">النتيجة</th>
              <th className="py-2">الوحدة</th>
              <th className="py-2">النطاق الطبيعي</th>
              <th className="py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="py-2 font-medium">
                  {it.name_ar}
                  {it.name_en && (
                    <span className="block text-xs text-gray-500">{it.name_en}</span>
                  )}
                  {it.is_special && (it.physical_inspection || it.microscopic) && (
                    <div className="mt-1 text-xs text-gray-600">
                      {it.physical_inspection && (
                        <div>
                          فحص عيني: لون {it.physical_inspection.color ?? "—"}، مظهر{" "}
                          {it.physical_inspection.appearance ?? "—"}، رواسب{" "}
                          {it.physical_inspection.sediment ?? "—"}
                        </div>
                      )}
                      {it.microscopic && (
                        <div>
                          مجهري: RBC {it.microscopic.rbc ?? "—"}، Pus{" "}
                          {it.microscopic.pus_cells ?? "—"}، أملاح{" "}
                          {it.microscopic.crystals ?? "—"}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2">
                  {it.value_numeric ?? it.value_text ?? (it.is_special ? "↓ تفاصيل" : "—")}
                </td>
                <td className="py-2">{it.unit ?? "—"}</td>
                <td className="py-2">
                  {it.normal_low ?? ""}
                  {it.normal_low != null || it.normal_high != null ? " – " : ""}
                  {it.normal_high ?? ""}
                </td>
                <td className="py-2">
                  <FlagChip flag={it.flag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between text-xs text-gray-500">
          <span>رمز التحقق: {token}</span>
          <span>Spir Lab Manager</span>
        </div>
      </div>
    </div>
  );
}
