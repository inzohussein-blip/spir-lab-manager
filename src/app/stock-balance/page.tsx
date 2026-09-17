import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, StatTile } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Stock valuation: quantity × buy price per reagent, and totals. */
export default async function StockBalancePage() {
  const [rows, totals] = await Promise.all([
    query<any>(
      `select id, name, unit, quantity, buy_price,
              (quantity * buy_price) as value
         from products where is_active
        order by (quantity * buy_price) desc`
    ),
    queryOne<any>(
      `select coalesce(sum(quantity * buy_price),0) as total_value,
              count(*)::int as items,
              count(*) filter (where quantity <= min_quantity)::int as low
         from products where is_active`
    ),
  ]);

  return (
    <div>
      <PageHeader title="أرصدة المخزون" subtitle="تقييم المخزون بحسب سعر الشراء" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="قيمة المخزون" value={`${money(totals?.total_value)} ر.س`} />
        <StatTile label="عدد المواد" value={totals?.items ?? 0} tone="neutral" />
        <StatTile label="تحت الحد الأدنى" value={totals?.low ?? 0} tone={Number(totals?.low) ? "danger" : "brand"} />
      </div>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">المادة</th>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium">سعر الشراء</th>
              <th className="px-4 py-3 font-medium">القيمة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">
                  <a href={`/inventory/${p.id}`} className="text-brand-dark hover:underline">{p.name}</a>
                </td>
                <td className="px-4 py-3">{p.quantity} {p.unit}</td>
                <td className="px-4 py-3 text-muted">{money(p.buy_price)}</td>
                <td className="px-4 py-3 font-medium">{money(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
