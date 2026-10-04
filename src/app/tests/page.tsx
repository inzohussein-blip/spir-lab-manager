import { FlaskConical, Layers, Coins } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Card, Button, StatTile, Badge } from "@/components/ui/primitives";
import { addTest, setTestReagent } from "@/app/actions/tests";
import { money } from "@/lib/utils";
import { TestPriceCell } from "@/components/TestPriceCell";
import { TestLimitsCell } from "@/components/TestLimitsCell";
import { ensureDesk } from "@/lib/desk/schema";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default async function TestsPage() {
  await ensureDesk();
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
    critical_low: number | null;
    critical_high: number | null;
    tat_minutes: number | null;
    reagent_product_id: string | null;
    reagent_qty_per_test: number | null;
  }>(
    `select id, code, name_ar, category, sample_type, unit, normal_low, normal_high, price, critical_low, critical_high, tat_minutes, reagent_product_id, reagent_qty_per_test
       from test_catalog where is_active order by category nulls last, name_ar`
  );

  const products = await query<{ id: string; name: string }>(`select id, name from products where is_active order by name`);
  const categories = new Set(tests.map((t) => t.category).filter(Boolean));
  const priced = tests.filter((t) => Number(t.price) > 0);
  const avgPrice = priced.length
    ? priced.reduce((s, t) => s + Number(t.price), 0) / priced.length
    : 0;

  return (
    <div>
      <PageHeader
        title="كتالوج الفحوصات"
        subtitle="النطاقات الطبيعية تُستخدم لترميز H/L تلقائياً"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="عدد الفحوصات" value={tests.length} icon={<FlaskConical className="size-5" />} />
        <StatTile label="التصنيفات" value={categories.size} tone="neutral" icon={<Layers className="size-5" />} />
        <StatTile label="متوسط السعر" value={`${money(avgPrice)} د.ع`} hint={`${priced.length} فحص مسعّر`} tone="neutral" icon={<Coins className="size-5" />} />
      </div>

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">إضافة فحص جديد</div>
        <form action={addTest} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input name="name_ar" placeholder="اسم الفحص (عربي)" required className={field} />
          <input name="name_en" placeholder="Name (English)" className={field} />
          <input name="code" placeholder="الرمز" className={field} />
          <input name="category" placeholder="التصنيف" className={field} />
          <input name="sample_type" placeholder="نوع العينة" className={field} />
          <input name="unit" placeholder="الوحدة" className={field} />
          <input name="normal_low" type="number" step="any" placeholder="أدنى طبيعي" className={field} />
          <input name="normal_high" type="number" step="any" placeholder="أعلى طبيعي" className={field} />
          <input name="price" type="number" step="any" min="0" placeholder="السعر (اختياري)" className={field} />
          <label className="flex items-center gap-2 text-sm">
            <input name="is_special" type="checkbox" className="size-4" />
            فحص خاص (بول/براز)
          </label>
          <Button>إضافة الفحص</Button>
        </form>
      </Card>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الرمز</th>
              <th className="px-4 py-3 font-medium">الفحص</th>
              <th className="px-4 py-3 font-medium">التصنيف</th>
              <th className="px-4 py-3 font-medium">العينة</th>
              <th className="px-4 py-3 font-medium">النطاق الطبيعي</th>
              <th className="px-4 py-3 font-medium">السعر (اضغط للتعديل)</th>
              <th className="px-4 py-3 font-medium" title="نتيجة أقل من الحد الأدنى أو أعلى من الأعلى تُبلَّغ فوراً؛ والمدة: متى تظهر العيّنة متأخرة">القيم الحرجة · المدة</th>
              <th className="px-4 py-3 font-medium" title="تُخصم من المخزون تلقائياً عند طلب الفحص">المادة المستهلكة</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr
                key={t.id}
                className="border-b border-line last:border-0 hover:bg-canvas"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted">{t.code ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{t.name_ar}</td>
                <td className="px-4 py-3">
                  {t.category ? <Badge>{t.category}</Badge> : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-muted">{t.sample_type ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {t.normal_low != null || t.normal_high != null
                    ? `${t.normal_low ?? ""} – ${t.normal_high ?? ""} ${t.unit ?? ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3"><TestPriceCell id={t.id} price={t.price} /></td>
                <td className="px-4 py-3">
                  <TestLimitsCell id={t.id} low={t.critical_low == null ? null : Number(t.critical_low)} high={t.critical_high == null ? null : Number(t.critical_high)} tat={t.tat_minutes} />
                </td>
                <td className="px-4 py-3">
                  <form action={setTestReagent} className="flex items-center gap-1" data-testid="test-reagent">
                    <input type="hidden" name="test_id" value={t.id} />
                    <select name="product_id" defaultValue={t.reagent_product_id ?? ""} aria-label={`مادة ${t.name_ar}`} className="max-w-36 rounded-lg border border-line bg-surface px-1.5 py-1 text-xs">
                      <option value="">بلا</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input name="qty" type="number" step="any" min="0" defaultValue={t.reagent_qty_per_test ?? ""} placeholder="كمية" aria-label={`كمية ${t.name_ar}`} className="w-14 rounded-lg border border-line px-1.5 py-1 text-xs" />
                    <button className="rounded-lg bg-brand-light px-1.5 py-1 text-[11px] font-semibold text-brand-dark">حفظ</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
