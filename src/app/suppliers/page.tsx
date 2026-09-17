import { query } from "@/lib/db";
import { addSupplier } from "@/app/actions/expenses";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default async function SuppliersPage() {
  const rows = await query<any>(
    `select s.id, s.name, s.phone, count(po.id)::int as orders
       from suppliers s
       left join purchase_orders po on po.supplier_id = s.id
      group by s.id order by s.name`
  );

  return (
    <div className="max-w-2xl">
      <PageHeader title="الموردون" subtitle="موردو الكواشف والمواد" />

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">إضافة مورّد</div>
        <form action={addSupplier} className="grid gap-2 sm:grid-cols-3">
          <input name="name" placeholder="الاسم" required className={field} />
          <input name="phone" placeholder="الهاتف" className={field} />
          <Button>إضافة</Button>
        </form>
      </Card>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">المورّد</th>
              <th className="px-4 py-3 font-medium">الهاتف</th>
              <th className="px-4 py-3 font-medium">أوامر الشراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">لا موردين بعد</td></tr>
            )}
            {rows.map((s: any) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.phone ?? "—"}</td>
                <td className="px-4 py-3">{s.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
