import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const tests = await query<{
    id: string;
    code: string | null;
    name_ar: string;
    category: string | null;
    sample_type: string | null;
    unit: string | null;
    normal_low: number | null;
    normal_high: number | null;
    price: number;
  }>(
    `select id, code, name_ar, category, sample_type, unit, normal_low, normal_high, price
       from test_catalog where is_active order by category, name_ar`
  );

  return (
    <div>
      <PageHeader
        title="كتالوج الفحوصات"
        subtitle="النطاقات الطبيعية تُستخدم لترميز H/L تلقائياً"
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الرمز</th>
              <th className="px-4 py-3 font-medium">الفحص</th>
              <th className="px-4 py-3 font-medium">التصنيف</th>
              <th className="px-4 py-3 font-medium">العينة</th>
              <th className="px-4 py-3 font-medium">النطاق الطبيعي</th>
              <th className="px-4 py-3 font-medium">السعر</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr
                key={t.id}
                className="border-b border-line last:border-0 hover:bg-canvas"
              >
                <td className="px-4 py-3 text-muted">{t.code ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{t.name_ar}</td>
                <td className="px-4 py-3">{t.category ?? "—"}</td>
                <td className="px-4 py-3">{t.sample_type ?? "—"}</td>
                <td className="px-4 py-3">
                  {t.normal_low != null || t.normal_high != null
                    ? `${t.normal_low ?? ""} – ${t.normal_high ?? ""} ${t.unit ?? ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{t.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
