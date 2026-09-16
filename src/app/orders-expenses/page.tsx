import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, StatTile } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersExpensesPage() {
  const [expenses, totals, purchases] = await Promise.all([
    query<any>(
      `select id, title, amount, spent_on, category from expenses
        order by spent_on desc limit 30`
    ),
    queryOne<{ month: number; week: number; day: number }>(
      `select
         coalesce(sum(amount) filter (where spent_on >= date_trunc('month', current_date)),0) as month,
         coalesce(sum(amount) filter (where spent_on >= current_date - interval '7 days'),0) as week,
         coalesce(sum(amount) filter (where spent_on = current_date),0) as day
       from expenses`
    ),
    query<any>(
      `select po.id, po.order_date, po.total_amount, s.name as supplier
         from purchase_orders po
         left join suppliers s on s.id = po.supplier_id
        order by po.order_date desc limit 15`
    ),
  ]);

  return (
    <div>
      <PageHeader
        title="الطلبيات والمصروفات"
        subtitle="القسم 4 — تقارير مالية مقسّمة (اليوم/الأسبوع/الشهر)"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="مصروف اليوم" value={money(totals?.day)} tone="neutral" />
        <StatTile label="مصروف الأسبوع" value={money(totals?.week)} tone="neutral" />
        <StatTile label="مصروف الشهر" value={money(totals?.month)} tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">المصروفات</div>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted">لا توجد مصروفات مسجّلة</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {expenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="py-2">{e.spent_on}</td>
                    <td className="py-2 font-medium">{e.title}</td>
                    <td className="py-2 text-muted">{e.category ?? "—"}</td>
                    <td className="py-2 text-left">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="mb-3 font-semibold">أوامر الشراء (الطلبيات)</div>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted">لا توجد طلبيات مسجّلة</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {purchases.map((p: any) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-2">{p.order_date}</td>
                    <td className="py-2 font-medium">{p.supplier ?? "—"}</td>
                    <td className="py-2 text-left">{money(p.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
