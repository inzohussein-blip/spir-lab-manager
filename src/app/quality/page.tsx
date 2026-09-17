import { query, queryOne } from "@/lib/db";
import { addQcRun } from "@/app/actions/quality";
import { PageHeader, Card, Button, StatTile } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const statusLabel: Record<string, string> = { pass: "مقبول", warn: "تحذير", fail: "فاشل" };
const statusTone: Record<string, string> = {
  pass: "bg-teal-50 text-brand-dark",
  warn: "bg-amber-50 text-amber-700",
  fail: "bg-red-50 text-red-600",
};

export default async function QualityPage() {
  const [runs, summary] = await Promise.all([
    query<any>(`select * from qc_runs order by run_at desc limit 100`),
    queryOne<any>(
      `select count(*)::int as total,
              count(*) filter (where status='pass')::int as pass,
              count(*) filter (where status='fail')::int as fail
         from qc_runs where run_at >= current_date - interval '30 days'`
    ),
  ]);
  const rate = summary?.total ? Math.round((summary.pass / summary.total) * 100) : 100;

  return (
    <div>
      <PageHeader title="مراقبة الجودة (QC)" subtitle="تشغيل المحاليل الضابطة ومتابعة الأداء" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="نسبة القبول (30 يوماً)" value={`${rate}%`} tone={rate < 90 ? "warn" : "brand"} />
        <StatTile label="عدد التشغيلات" value={summary?.total ?? 0} tone="neutral" />
        <StatTile label="فاشلة" value={summary?.fail ?? 0} tone={Number(summary?.fail) ? "danger" : "brand"} />
      </div>

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">تسجيل تشغيل QC</div>
        <form action={addQcRun} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input name="control_name" placeholder="اسم الضابط (Level 1…)" required className={field} />
          <input name="analyte" placeholder="التحليل" className={field} />
          <input name="target" type="number" step="any" placeholder="القيمة المستهدفة" className={field} />
          <input name="measured" type="number" step="any" placeholder="القيمة المقاسة" className={field} />
          <input name="tolerance" type="number" step="any" placeholder="سماح % (افتراضي 10)" className={field} />
          <input name="unit" placeholder="الوحدة" className={field} />
          <div className="lg:col-span-4"><Button>تسجيل</Button></div>
        </form>
      </Card>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">الضابط</th>
              <th className="px-4 py-3 font-medium">التحليل</th>
              <th className="px-4 py-3 font-medium">المستهدف/المقاس</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">لا تشغيلات بعد</td></tr>
            )}
            {runs.map((r: any) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-muted">{String(r.run_at).slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3 font-medium">{r.control_name}</td>
                <td className="px-4 py-3">{r.analyte ?? "—"}</td>
                <td className="px-4 py-3">{r.target ?? "—"} / {r.measured ?? "—"} {r.unit ?? ""}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[r.status]}`}>{statusLabel[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
