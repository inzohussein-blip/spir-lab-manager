import { query } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { addReagent, restock } from "@/app/actions/inventory";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default async function InventoryPage() {
  const products = await query<{
    id: string;
    name: string;
    unit: string;
    quantity: number;
    min_quantity: number;
    expiry_date: string | null;
  }>(
    `select id, name, unit, quantity, min_quantity, expiry_date
       from products where is_active order by name`
  );

  const soon = (d: string | null) =>
    d ? new Date(d).getTime() - Date.now() < 30 * 864e5 : false;

  return (
    <div>
      <PageHeader
        title="المخزون والكواشف"
        subtitle="القسم 3 — يُخصم تلقائياً عند إجراء الفحوصات"
      />

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">إضافة مادة / كاشف جديد</div>
        <form
          action={addReagent}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"
        >
          <input name="name" placeholder="اسم المادة" required className={cn(field, "lg:col-span-2")} />
          <input name="quantity" type="number" step="any" placeholder="الكمية" className={field} />
          <input name="min_quantity" type="number" step="any" placeholder="الحد الأدنى" className={field} />
          <input name="expiry_date" type="date" className={field} />
          <Button>إضافة</Button>
        </form>
      </Card>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">المادة</th>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium">الحد الأدنى</th>
              <th className="px-4 py-3 font-medium">تاريخ الانتهاء</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إعادة تعبئة</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const low = Number(p.quantity) <= Number(p.min_quantity);
              return (
                <tr
                  key={p.id}
                  className="border-b border-line last:border-0 hover:bg-canvas"
                >
                  <td className="px-4 py-3 font-medium">
                    <a href={`/inventory/${p.id}`} className="text-brand-dark hover:underline">
                      {p.name}
                    </a>
                  </td>
                  <td className={cn("px-4 py-3", low && "font-bold text-red-600")}>
                    {p.quantity} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.min_quantity}</td>
                  <td
                    className={cn(
                      "px-4 py-3",
                      soon(p.expiry_date) && "text-amber-700"
                    )}
                  >
                    {p.expiry_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {low ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        تحت الحد الأدنى
                      </span>
                    ) : soon(p.expiry_date) ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        قرب الانتهاء
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-brand-dark">
                        جيد
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={restock} className="flex items-center gap-1">
                      <input type="hidden" name="product_id" value={p.id} />
                      <input
                        name="amount"
                        type="number"
                        step="any"
                        placeholder="+"
                        className="w-16 rounded-lg border border-line px-2 py-1 text-sm outline-none focus:border-brand"
                      />
                      <button className="rounded-lg bg-brand-light px-2 py-1 text-xs font-semibold text-brand-dark hover:bg-teal-100">
                        تعبئة
                      </button>
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
