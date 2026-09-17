import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, StatTile, Button } from "@/components/ui/primitives";
import { addExpense, addSupplier, addPurchaseOrder } from "@/app/actions/expenses";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default async function OrdersExpensesPage() {
  const [expenses, totals, purchases, suppliers] = await Promise.all([
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
    query<any>(`select id, name from suppliers order by name`),
  ]);

  return (
    <div>
      <PageHeader
        title="الطلبيات والمصروفات"
        subtitle="القسم 4 — تقارير مالية مقسّمة (اليوم/الأسبوع/الشهر)"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="مصروف اليوم" value={`${money(totals?.day)} د.ع`} tone="neutral" />
        <StatTile label="مصروف الأسبوع" value={`${money(totals?.week)} د.ع`} tone="neutral" />
        <StatTile label="مصروف الشهر" value={`${money(totals?.month)} د.ع`} tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">المصروفات</div>
          <form action={addExpense} className="mb-4 grid gap-2 border-b border-line pb-4 sm:grid-cols-2">
            <input name="title" placeholder="البيان" required className={field} />
            <input name="amount" type="number" step="any" placeholder="القيمة" className={field} />
            <input name="category" placeholder="التصنيف" className={field} />
            <input name="spent_on" type="date" className={field} />
            <div className="sm:col-span-2">
              <Button>إضافة مصروف</Button>
            </div>
          </form>
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
                    <td className="py-2 text-left tabular-nums">{money(e.amount)} د.ع</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="mb-3 font-semibold">أوامر الشراء (الطلبيات)</div>
          <form action={addPurchaseOrder} className="mb-3 grid gap-2 border-b border-line pb-4 sm:grid-cols-2">
            <select name="supplier_id" className={field} defaultValue="">
              <option value="">المورّد…</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input name="total_amount" type="number" step="any" placeholder="القيمة الإجمالية" className={field} />
            <input name="order_date" type="date" className={field} />
            <input name="notes" placeholder="ملاحظات" className={field} />
            <div className="sm:col-span-2">
              <Button>تسجيل طلبية</Button>
            </div>
          </form>
          <form action={addSupplier} className="mb-4 grid gap-2 border-b border-line pb-4 sm:grid-cols-3">
            <input name="name" placeholder="اسم مورّد جديد" required className={field} />
            <input name="phone" placeholder="الهاتف" className={field} />
            <Button variant="ghost">إضافة مورّد</Button>
          </form>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted">لا توجد طلبيات مسجّلة</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {purchases.map((p: any) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-2">{p.order_date}</td>
                    <td className="py-2 font-medium">{p.supplier ?? "—"}</td>
                    <td className="py-2 text-left tabular-nums">{money(p.total_amount)} د.ع</td>
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
