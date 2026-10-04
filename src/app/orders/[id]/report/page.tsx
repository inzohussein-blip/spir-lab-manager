import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { query, queryOne } from "@/lib/db";
import { labTarget } from "@/lib/db/lab";
import { barcodeSvg } from "@/lib/barcode";
import Link from "next/link";
import { getLabIdentity, getReportLook, labLogo, labName } from "@/lib/lab-identity";
import { tableColors } from "@/lib/station/tableStyle";
import { categoryEn } from "@/lib/categoryEn";
import { formPlain } from "@/lib/station/formPlain";
import { PrintButton } from "@/components/PrintButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ReportImageButton } from "@/components/ReportImageButton";

export const dynamic = "force-dynamic";

/** The report's words in Arabic and English (Settings → «شكل تقرير النتائج» → the English report). */
const T = {
  ar: {
    scan: "امسح للتحقق", patient: "المريض", sample: "رقم العيّنة", date: "التاريخ", gender: "الجنس", male: "ذكر", female: "أنثى",
    age: "العمر", phone: "الهاتف", referrer: "الطبيب المُحيل", pending: (n: number) => `تقرير أوّلي — ${n} فحص بلا نتيجة بعد.`,
    test: "الفحص", result: "النتيجة", unit: "الوحدة", range: "النطاق الطبيعي", status: "الحالة", details: "↓ تفاصيل",
    high: "H مرتفع", low: "L منخفض", normal: "طبيعي",
    physical: (c: string, a: string, s: string) => `فحص عيني: لون ${c}، مظهر ${a}، رواسب ${s}`,
    micro: (r: string, p: string, c: string) => `مجهري: RBC ${r}، Pus ${p}، أملاح ${c}`,
    interp: "التفسير", abnormal: (n: number) => `${n} قراءة غير طبيعية`,
    none: "لم تُدخَل نتائج بعد لهذا الطلب.",
    someAbn: "توجد قراءات خارج النطاق الطبيعي (موسومة H/L). تُفسَّر هذه النتائج مع التاريخ المرضي والحالة السريرية والأدوية الحالية، ويعود القرار النهائي للطبيب المختص.",
    allOk: "جميع القراءات المُبلَّغة تقع ضمن النطاقات الطبيعية. لا يُستدل من هذه النتائج وحدها على إجراء بعينه؛ تُقرأ مع الحالة السريرية.",
    approved: "اعتمد النتائج:", sign: "التوقيع / الختم", signature: "التوقيع", stamp: "الختم", code: "رمز التحقق", issued: "أُصدر",
    private: "وثيقة سرّية تخص المريض المذكور. يُتحقق من صحتها عبر مسح رمز QR.",
  },
  en: {
    scan: "Scan to verify", patient: "Patient", sample: "Sample No.", date: "Date", gender: "Sex", male: "Male", female: "Female",
    age: "Age", phone: "Phone", referrer: "Referring doctor", pending: (n: number) => `Preliminary report — ${n} test${n === 1 ? "" : "s"} without a result yet.`,
    test: "Test", result: "Result", unit: "Unit", range: "Reference range", status: "Flag", details: "↓ details",
    high: "H High", low: "L Low", normal: "Normal",
    physical: (c: string, a: string, s: string) => `Physical: colour ${c}, appearance ${a}, sediment ${s}`,
    micro: (r: string, p: string, c: string) => `Microscopic: RBC ${r}, Pus ${p}, crystals ${c}`,
    interp: "Interpretation", abnormal: (n: number) => `${n} abnormal reading${n === 1 ? "" : "s"}`,
    none: "No results have been entered for this order yet.",
    someAbn: "Some readings are outside the reference range (flagged H/L). Results should be interpreted together with the medical history, clinical condition and current medication; the final decision rests with the treating physician.",
    allOk: "All reported readings are within their reference ranges. These results alone do not indicate any specific action; read them with the clinical picture.",
    approved: "Results approved by:", sign: "Signature / Stamp", signature: "Signature", stamp: "Stamp", code: "Verification code", issued: "Issued",
    private: "Confidential document for the named patient. Its authenticity can be checked by scanning the QR code.",
  },
};

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

export default async function ReportPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ lang?: string }>;
  }
) {
  const params = await props.params;
  const sp = await props.searchParams;
  const order = await queryOne<any>(
    `select o.*, p.full_name, p.gender, p.age_years, p.phone, r.name as referrer_name
       from test_orders o join patients p on p.id = o.patient_id
       left join referrers r on r.id = o.referrer_id
      where o.id = $1`,
    [params.id]
  );
  if (!order) notFound();
  const identity = await getLabIdentity();
  // The lab's report look: colours, signature and stamp, and the language (this print can switch).
  const look = await getReportLook();
  const lang: "ar" | "en" = sp.lang === "en" || sp.lang === "ar" ? sp.lang : look.lang;
  const en = lang === "en";
  const t = T[lang];
  const c = tableColors(look.intensity, look.primary, look.accent);
  const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as const;
  const title = en ? look.nameEn || labName(identity) : labName(identity);
  const subtitle = en ? look.subtitleEn || identity.subtitle : identity.subtitle;
  const footer = en ? look.footerEn || identity.footer : identity.footer;

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
  const h = await headers();
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (h.get("x-forwarded-host") || h.get("host")
      ? `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`
      : "");
  // A lab on its own database: the code tells /verify where to look.
  const lab = await labTarget();
  const verifyUrl = `${base}/verify/${token}${lab ? `?l=${encodeURIComponent(lab.lid)}` : ""}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });
  const barcode = order.accession_no ? await barcodeSvg(order.accession_no) : "";

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <PrintButton />
        {/* This print's language (Settings → «شكل تقرير النتائج» sets the one it opens in) */}
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm" data-testid="report-lang">
          <Link href="?lang=ar" replace aria-current={!en ? "true" : undefined} className={`px-3 py-2 ${!en ? "bg-brand text-white" : "hover:bg-canvas"}`}>العربية</Link>
          <Link href="?lang=en" replace aria-current={en ? "true" : undefined} className={`px-3 py-2 ${en ? "bg-brand text-white" : "hover:bg-canvas"}`}>English</Link>
        </div>
        <ReportImageButton targetId="report-sheet" fileName={order.accession_no || "report"} />
        {order.phone && <WhatsAppButton orderId={order.id} />}
      </div>

      {/* A4 report sheet */}
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        #report-sheet { min-height: 295mm; }
      }`}</style>
      <div id="report-sheet" dir={en ? "ltr" : "rtl"} lang={lang} className="relative isolate mx-auto flex max-w-[210mm] flex-col bg-white p-8 text-black shadow-sm print:p-[14mm] print:shadow-none">
        {/* Faint centered logo watermark */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={labLogo(identity)} alt="" className="w-1/2 max-w-[110mm] opacity-[0.06]" />
        </div>

        {/* Header — lab letterhead in the lab's colours */}
        <div className="flex items-center justify-between gap-4 border-b-4 pb-4" style={{ borderColor: c.border, ...exact }}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={labLogo(identity)} alt="" width={64} height={64} className="size-16 object-contain" />
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: c.title }}>{title}</h1>
              {subtitle && <p className="text-sm font-medium" style={{ color: c.subtitle }}>{subtitle}</p>}
            </div>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" width={82} height={82} />
            <div className="text-[10px] text-gray-500">{t.scan}</div>
          </div>
        </div>

        {/* Patient meta block */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-3">
          <div><span className="text-gray-500">{t.patient}:</span> <b>{order.full_name}</b></div>
          <div>
            <span className="text-gray-500">{t.sample}:</span> {order.accession_no ?? "—"}
            {barcode && (
              <span
                className="mt-1 block h-6 w-40"
                dangerouslySetInnerHTML={{ __html: barcode }}
              />
            )}
          </div>
          <div><span className="text-gray-500">{t.date}:</span> {order.order_date}</div>
          <div>
            <span className="text-gray-500">{t.gender}:</span>{" "}
            {order.gender === "male" ? t.male : order.gender === "female" ? t.female : "—"}
          </div>
          <div><span className="text-gray-500">{t.age}:</span> {order.age_years ?? "—"}</div>
          <div><span className="text-gray-500">{t.phone}:</span> <span dir="ltr">{order.phone ?? "—"}</span></div>
          {order.referrer_name && (
            <div><span className="text-gray-500">{t.referrer}:</span> {order.referrer_name}</div>
          )}
        </div>

        {/* Incomplete-results notice — keep a partial report from passing as final */}
        {pendingCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            {t.pending(pendingCount)}
          </div>
        )}

        {/* Results grouped by department */}
        {Array.from(groups.entries()).map(([category, rows]) => (
          <div key={category} className="mt-5">
            <div className="mb-1 border-b pb-1 text-sm font-bold" style={{ color: c.groupText, borderColor: c.line }} data-testid="report-category">
              {en ? categoryEn(category) : category}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-start text-xs text-gray-500">
                  <th className="py-1.5 text-start font-medium">{t.test}</th>
                  <th className="py-1.5 text-start font-medium">{t.result}</th>
                  <th className="py-1.5 text-start font-medium">{t.unit}</th>
                  <th className="py-1.5 text-start font-medium">{t.range}</th>
                  <th className="py-1.5 text-start font-medium">{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-2 font-medium">
                      {en ? it.name_en || it.name_ar : it.name_ar}
                      {!en && it.name_en && (
                        <span className="block text-xs font-normal text-gray-500">{it.name_en}</span>
                      )}
                      {it.is_special && (it.physical_inspection || it.microscopic) && (
                        <div className="mt-1 text-xs font-normal text-gray-600">
                          {it.physical_inspection && (
                            <div>
                              {t.physical(it.physical_inspection.color ?? "—", it.physical_inspection.appearance ?? "—", it.physical_inspection.sediment ?? "—")}
                            </div>
                          )}
                          {it.microscopic && (
                            <div>
                              {t.micro(it.microscopic.rbc ?? "—", it.microscopic.pus_cells ?? "—", it.microscopic.crystals ?? "—")}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={it.flag === "H" || it.flag === "L" ? "font-bold" : ""}>
                        {it.value_numeric ?? (it.value_text != null ? formPlain(it.value_text) : null) ?? (it.is_special ? t.details : "—")}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{it.unit ?? "—"}</td>
                    <td className="py-2 text-gray-600" dir="ltr" style={{ textAlign: en ? "left" : "right" }}>
                      {it.normal_low ?? ""}
                      {it.normal_low != null || it.normal_high != null ? " – " : ""}
                      {it.normal_high ?? ""}
                    </td>
                    <td className="py-2">
                      {it.flag === "H" ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-600">{t.high}</span>
                      ) : it.flag === "L" ? (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-600">{t.low}</span>
                      ) : it.flag === "N" ? (
                        <span className="text-xs text-teal-700">{t.normal}</span>
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
          <div className="mb-1 flex items-center gap-2 font-bold" style={{ color: c.groupText }}>
            {t.interp}
            {abnormalCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                {t.abnormal(abnormalCount)}
              </span>
            )}
          </div>
          <p className="leading-relaxed text-gray-700">
            {!anyResult ? t.none : hasAbnormal ? t.someAbn : t.allOk}
          </p>
        </div>

        {/* Footer group — pinned to the page bottom */}
        <div className="mt-auto">
          <div className="mt-8 flex items-end justify-between gap-6 border-t border-gray-200 pt-5 text-xs text-gray-600">
            {look.signatureOn ? (
              // Settings → «التوقيع والختم على التقرير»: the signature, the name and title, and the stamp.
              <div className="flex items-end gap-3" data-testid="report-signature">
                <div className="text-center">
                  <div className="mb-1 text-start">{t.approved}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {look.signature ? <img src={look.signature} alt={t.signature} className="mx-auto h-14 max-w-48 object-contain" /> : <div className="h-8" />}
                  <div className="w-48 border-t pt-1 font-semibold text-gray-700" style={{ borderColor: c.border }}>{look.signatureName || t.signature}</div>
                  {look.signatureTitle && <div className="text-[10px] text-gray-500">{look.signatureTitle}</div>}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {look.stamp && <img src={look.stamp} alt={t.stamp} className="size-24 object-contain opacity-90" data-testid="report-stamp" />}
              </div>
            ) : (
              <div>
                <div className="mb-6">{t.approved}</div>
                <div className="w-48 border-t border-gray-400 pt-1 text-center text-gray-500">
                  {t.sign}
                </div>
              </div>
            )}
            <div className="text-end">
              <div>{t.code}: <span className="font-mono">{token}</span></div>
              <div>{t.issued}: <span dir="ltr">{new Date().toISOString().slice(0, 16).replace("T", " ")}</span></div>
              <div className="mt-2 max-w-xs text-gray-400">
                {t.private}
              </div>
            </div>
          </div>

          {footer && (
            <div
              className="mt-6 rounded-md px-4 py-2 text-center text-xs font-medium text-white"
              style={{ background: c.bar, ...exact }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
