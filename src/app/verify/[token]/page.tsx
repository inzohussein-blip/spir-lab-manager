import { ShieldCheck, ShieldX, FlaskConical } from "lucide-react";
import { queryOne, query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public report verification page (section 8). Anyone who scans the QR on a
 * printed report lands here and can confirm the report is authentic and matches
 * the patient/date on paper. No login, minimal data — enough to verify.
 */
export default async function VerifyPage({
  params,
}: {
  params: { token: string };
}) {
  const report = await queryOne<any>(
    `select r.generated_at, r.order_id,
            p.full_name, o.order_date, o.status
       from reports r
       join test_orders o on o.id = r.order_id
       join patients p on p.id = r.patient_id
      where r.qr_token = $1`,
    [params.token]
  );

  const testCount = report
    ? (
        await queryOne<{ c: number }>(
          `select count(*)::int as c from test_order_items where order_id = $1`,
          [report.order_id]
        )
      )?.c ?? 0
    : 0;

  const valid = !!report;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-sm">
        <div className="mb-5 flex items-center justify-center gap-2 text-brand-dark">
          <FlaskConical className="size-5" />
          <span className="font-bold">مختبر التحاليل الطبية</span>
        </div>

        {valid ? (
          <>
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-teal-50 text-brand-dark">
                <ShieldCheck className="size-8" />
              </span>
              <div className="text-lg font-bold text-brand-dark">تقرير موثّق ✓</div>
              <p className="text-sm text-muted">
                هذا التقرير صادر عن المختبر ومطابق للسجل الرسمي.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-y-3 border-t border-line pt-4 text-sm">
              <dt className="text-muted">المريض</dt>
              <dd className="font-medium">{report.full_name}</dd>
              <dt className="text-muted">تاريخ الطلب</dt>
              <dd>{report.order_date}</dd>
              <dt className="text-muted">عدد الفحوصات</dt>
              <dd>{testCount}</dd>
              <dt className="text-muted">تاريخ الإصدار</dt>
              <dd>{String(report.generated_at).slice(0, 10)}</dd>
            </dl>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
              <ShieldX className="size-8" />
            </span>
            <div className="text-lg font-bold text-red-600">تقرير غير معروف</div>
            <p className="text-sm text-muted">
              لم نتمكّن من التحقق من هذا الرمز. تأكّد من مسح الرمز الصحيح، أو راجع
              المختبر.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          رمز التحقق: {params.token}
        </p>
      </div>
    </div>
  );
}
