import { query } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { InventoryTabs } from "@/components/InventoryTabs";
import { saveStocktake } from "@/app/actions/stock";
import { ensureOps } from "@/lib/desk/schema";

export const dynamic = "force-dynamic";

/** «الجرد»: count everything on the shelves; the differences are booked and the count is kept. */
export default async function StocktakePage() {
  await ensureOps();
  const [products, counts] = await Promise.all([
    query<any>(`select id, name, unit, quantity from products where is_active order by name`),
    query<any>(`select id, counted_at::text as at, by_name, items, diffs, note from stock_counts order by counted_at desc limit 20`),
  ]);
  return (
    <div>
      <PageHeader title="الجرد" subtitle="اكتب الكمية المعدودة لكل مادة (اترك الفارغ لما لم يُعدّ) — تُصحَّح الأرصدة وتُسجَّل الفروقات في حركة المخزون" />
      <InventoryTabs active="/inventory/count" />
      <form action={saveStocktake}>
        <Card className="p-0 data-table">
          <table className="w-full text-sm" data-testid="stocktake">
            <thead className="border-b border-line text-right text-muted">
              <tr><th className="px-4 py-3 font-medium">المادة</th><th className="px-4 py-3 font-medium">في النظام</th><th className="px-4 py-3 font-medium">المعدود</th></tr>
            </thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">لا توجد مواد.</td></tr>}
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 tabular-nums">{Number(p.quantity)} {p.unit}</td>
                  <td className="px-4 py-2"><input name={`c_${p.id}`} type="number" step="any" aria-label={`المعدود ${p.name}`} className="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input name="note" placeholder="ملاحظة (مثلاً: جرد نهاية الشهر)" className="min-w-64 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          <Button>حفظ الجرد</Button>
        </div>
      </form>
      {counts.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 text-sm font-semibold">الجرود السابقة</div>
          <ul className="text-sm" data-testid="stock-counts">
            {counts.map((c) => (
              <li key={c.id} className="border-t border-line py-1.5"><span dir="ltr">{String(c.at).slice(0, 16)}</span> · {c.items} مادة · <b className={c.diffs ? "text-amber-700" : ""}>{c.diffs} فرق</b>{c.by_name && ` · ${c.by_name}`}{c.note && ` · ${c.note}`}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
