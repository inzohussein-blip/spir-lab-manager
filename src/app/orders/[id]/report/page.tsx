import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { query, queryOne } from "@/lib/db";
import { barcodeSvg } from "@/lib/barcode";
import { PrintButton } from "@/components/PrintButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ReportImageButton } from "@/components/ReportImageButton";

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
    `select o.*, p.full_name, p.gender, p.age_years, p.phone, r.name as referrer_name
       from test_orders o join patients p on p.id = o.patient_id
       left join referrers r on r.id = o.referrer_id
      where o.id = $1`,
    [params.id]
  );
  if (!order) notFound();

  const items = await query<any>(
    `select t.name_ar, t.name_en, t.unit, t.normal_low, t.normal_high, t.is_special,
            coalesce(t.category, 'فحوصات عامة') as category, t.sample_type,
            r.value_numeric, r.value_text, r.flag, r.physical_inspection, r.microscopic
       from test_order_items i
       join test_catalog t on t.id = i.test_id
       left join test_results r on r.order_item_id = i.id
      where i.order_id = $1 order by t.category, t.name_ar`,
    [params.id]
  );

  // Group results by department/category (DiagLab-style report layout).
  const groups = new Map<string, any[]>();
  for (const it of items) {
    const key = it.category as string;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const hasAbnormal = items.some((it: any) => it.flag === "H" || it.flag === "L");
  const hasResult = (it: any) =>
    it.value_numeric != null || it.value_text || it.physical_inspection || it.microscopic;
  const anyResult = items.some(hasResult);
  const pendingCount = items.filter((it: any) => !hasResult(it)).length;
  const abnormalCount = items.filter((it: any) => it.flag === "H" || it.flag === "L").length;

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
  const barcode = order.accession_no ? await barcodeSvg(order.accession_no) : "";

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <PrintButton />
        <ReportImageButton targetId="report-sheet" fileName={order.accession_no || "report"} />
        {order.phone && <WhatsAppButton orderId={order.id} />}
      </div>

      {/* A4 report sheet */}
      <div id="report-sheet" className="mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-teal-700 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-teal-700 text-xl font-bold text-white">
              م
            </span>
            <div>
              <h1 className="text-2xl font-bold text-teal-800">مختبر التحاليل الطبية</h1>
              <p className="text-sm text-gray-600">تقرير نتائج الفحوصات المرضية</p>
            </div>
          </div>
          <div className="text-center">
            <img src={qr} alt="QR" width={92} height={92} />
            <div className="text-[10px] text-gray-500">امسح للتحقق</div>
          </div>
        </div>

        {/* Patient meta block */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-3">
          <div><span className="text-gray-500">المريض:</span> <b>{order.full_name}</b></div>
          <div>
            <span className="text-gray-500">رقم العيّنة:</span> {order.accession_no ?? "—"}
            {barcode && (
              <span
                className="mt-1 block h-6 w-40"
                dangerouslySetInnerHTML={{ __html: barcode }}
              />
            )}
          </div>
          <div><span className="text-gray-500">التاريخ:</span> {order.order_date}</div>
          <div>
            <span className="text-gray-500">الجنس:</span>{" "}
            {order.gender === "male" ? "ذكر" : order.gender === "female" ? "أنثى" : "—"}
          </div>
          <div><span className="text-gray-500">العمر:</span> {order.age_years ?? "—"}</div>
          <div><span className="text-gray-500">الهاتف:</span> {order.phone ?? "—"}</div>
          {order.referrer_name && (
            <div><span className="text-gray-500">الطبيب المُحيل:</span> {order.referrer_name}</div>
          )}
        </div>

        {/* Incomplete-results notice — keep a partial report from passing as final */}
        {pendingCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            تقرير أوّلي — {pendingCount} فحص بلا نتيجة بعد.
          </div>
        )}

        {/* Results grouped by department */}
        {Array.from(groups.entries()).map(([category, rows]) => (
          <div key={category} className="mt-5">
            <div className="mb-1 border-b border-teal-200 pb-1 text-sm font-bold text-teal-800">
              {category}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-right text-xs text-gray-500">
                  <th className="py-1.5 font-medium">الفحص</th>
                  <th className="py-1.5 font-medium">النتيجة</th>
                  <th className="py-1.5 font-medium">الوحدة</th>
                  <th className="py-1.5 font-medium">النطاق الطبيعي</th>
                  <th className="py-1.5 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-2 font-medium">
                      {it.name_ar}
                      {it.name_en && (
                        <span className="block text-xs font-normal text-gray-500">{it.name_en}</span>
                      )}
                      {it.is_special && (it.physical_inspection || it.microscopic) && (
                        <div className="mt-1 text-xs font-normal text-gray-600">
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
                      <span className={it.flag === "H" || it.flag === "L" ? "font-bold" : ""}>
                        {it.value_numeric ?? it.value_text ?? (it.is_special ? "↓ تفاصيل" : "—")}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{it.unit ?? "—"}</td>
                    <td className="py-2 text-gray-600">
                      {it.normal_low ?? ""}
                      {it.normal_low != null || it.normal_high != null ? " – " : ""}
                      {it.normal_high ?? ""}
                    </td>
                    <td className="py-2">
                      {it.flag === "H" ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-600">H مرتفع</span>
                      ) : it.flag === "L" ? (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-600">L منخفض</span>
                      ) : it.flag === "N" ? (
                        <span className="text-xs text-teal-700">طبيعي</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Interpretation */}
        <div className="mt-6 rounded-lg border border-gray-200 p-4 text-sm">
          <div className="mb-1 flex items-center gap-2 font-bold text-teal-800">
            التفسير
            {abnormalCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                {abnormalCount} قراءة غير طبيعية
              </span>
            )}
          </div>
          <p className="leading-relaxed text-gray-700">
            {!anyResult
              ? "لم تُدخَل نتائج بعد لهذا الطلب."
              : hasAbnormal
              ? "توجد قراءات خارج النطاق الطبيعي (موسومة H/L). تُفسَّر هذه النتائج مع التاريخ المرضي والحالة السريرية والأدوية الحالية، ويعود القرار النهائي للطبيب المختص."
              : "جميع القراءات المُبلَّغة تقع ضمن النطاقات الطبيعية. لا يُستدل من هذه النتائج وحدها على إجراء بعينه؛ تُقرأ مع الحالة السريرية."}
          </p>
        </div>

        {/* Footer: signature + confidentiality + verification */}
        <div className="mt-8 flex items-end justify-between gap-6 border-t border-gray-200 pt-5 text-xs text-gray-600">
          <div>
            <div className="mb-6">اعتمد النتائج:</div>
            <div className="w-48 border-t border-gray-400 pt-1 text-center text-gray-500">
              التوقيع / الختم
            </div>
          </div>
          <div className="text-left">
            <div>رمز التحقق: <span className="font-mono">{token}</span></div>
            <div>أُصدر: {new Date().toISOString().slice(0, 16).replace("T", " ")}</div>
            <div className="mt-2 max-w-xs text-gray-400">
              وثيقة سرّية تخص المريض المذكور. يُتحقق من صحتها عبر مسح رمز QR.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
