import { query } from "@/lib/db";
import { restock } from "@/app/actions/inventory";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Reorder list: reagents at/below their minimum, with a suggested top-up qty
 *  (twice the minimum) and one-click restock. */
export default async function ReorderPage() {
  const rows = await query<any>(
    `select id, name, unit, quantity, min_quantity, expiry_date
       from products
      where is_active and quantity <= min_quantity
      order by (quantity - min_quantity) asc`
  );

  return (
    <div>
      <PageHeader
        title="إعادة الطلب"
        subtitle="المواد التي بلغت الحد الأدنى وتحتاج تعبئة"
      />
      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">المادة</th>
              <th className="px-4 py-3 font-medium">المتوفر</th>
              <th className="px-4 py-3 font-medium">الحد الأدنى</th>
              <th className="px-4 py-3 font-medium">الكمية المقترحة</th>
              <th className="px-4 py-3 font-medium">تعبئة سريعة</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">لا توجد مواد تحتاج إعادة طلب ✅</td></tr>
            )}
            {rows.map((p: any) => {
              const suggested = Math.max(Number(p.min_quantity) * 2 - Number(p.quantity), Number(p.min_quantity));
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <a href={`/inventory/${p.id}`} className="text-brand-dark hover:underline">{p.name}</a>
                  </td>
                  <td className="px-4 py-3 font-bold text-red-600">{p.quantity} {p.unit}</td>
                  <td className="px-4 py-3 text-muted">{p.min_quantity}</td>
                  <td className="px-4 py-3">{suggested}</td>
                  <td className="px-4 py-3">
                    <form action={restock} className="flex items-center gap-1">
                      <input type="hidden" name="product_id" value={p.id} />
                      <input name="amount" type="number" step="any" defaultValue={suggested}
                        className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand" />
                      <Button>تعبئة</Button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
