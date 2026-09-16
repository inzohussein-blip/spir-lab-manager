import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { adjustStock, reconcileStock } from "@/app/actions/stock";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const reasonLabel: Record<string, string> = {
  test: "استهلاك فحص",
  purchase: "شراء/تعبئة",
  adjustment: "تسوية يدوية",
  reconcile: "جرد",
  expiry: "إتلاف صلاحية",
};

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const p = await queryOne<any>(`select * from products where id = $1`, [params.id]);
  if (!p) notFound();

  const moves = await query<any>(
    `select change_qty, reason, created_at from stock_movements
      where product_id = $1 order by created_at desc limit 100`,
    [params.id]
  );

  const low = Number(p.quantity) <= Number(p.min_quantity);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={p.name}
        subtitle={`الرصيد الحالي: ${p.quantity} ${p.unit}${low ? " · تحت الحد الأدنى" : ""}`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-semibold">تسوية يدوية (+/−)</div>
          <form action={adjustStock} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="product_id" value={p.id} />
            <label className="text-xs text-muted">الكمية (سالبة للنقص)
              <input name="delta" type="number" step="any" className={field} />
            </label>
            <label className="text-xs text-muted">السبب
              <select name="reason" className={field}>
                <option value="adjustment">تسوية يدوية</option>
                <option value="purchase">شراء/تعبئة</option>
                <option value="expiry">إتلاف صلاحية</option>
              </select>
            </label>
            <div className="col-span-2"><Button>تطبيق</Button></div>
          </form>
        </Card>

        <Card>
          <div className="mb-3 text-sm font-semibold">جرد (تعيين الكمية الفعلية)</div>
          <form action={reconcileStock} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="product_id" value={p.id} />
            <label className="text-xs text-muted">الكمية المعدودة
              <input name="counted" type="number" step="any" defaultValue={p.quantity} className={field} />
            </label>
            <div className="col-span-2"><Button variant="ghost">تسجيل الجرد</Button></div>
          </form>
        </Card>
      </div>

      <Card className="mt-4 p-0">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">سجل الحركات</div>
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">التاريخ</th>
              <th className="px-4 py-2 font-medium">الحركة</th>
              <th className="px-4 py-2 font-medium">التغيّر</th>
            </tr>
          </thead>
          <tbody>
            {moves.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted">لا حركات بعد</td></tr>
            )}
            {moves.map((m: any, i: number) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-4 py-2 text-muted">{String(m.created_at).slice(0, 19).replace("T", " ")}</td>
                <td className="px-4 py-2">{reasonLabel[m.reason] ?? m.reason}</td>
                <td className={`px-4 py-2 font-medium ${Number(m.change_qty) < 0 ? "text-red-600" : "text-brand-dark"}`}>
                  {Number(m.change_qty) > 0 ? "+" : ""}{m.change_qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
