import { query } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { InventoryTabs } from "@/components/InventoryTabs";
import { addKit, deleteKit, receiveKits } from "@/app/actions/stock";
import { ensureOps } from "@/lib/desk/schema";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** «العبوات»: a kit holds a number of units of one item; receiving kits adds their units. */
export default async function KitsPage() {
  await ensureOps();
  const [products, kits] = await Promise.all([
    query<any>(`select id, name, unit from products where is_active order by name`),
    query<any>(`select k.id, k.name, k.units, p.name as product, p.unit, p.quantity from stock_kits k join products p on p.id = k.product_id order by k.name`),
  ]);
  return (
    <div>
      <PageHeader title="العبوات (Kits)" subtitle="عبوة فيها عدد من وحدات مادة (مثلاً علبة 100 فحص سكر) — استلام العبوات يضيف وحداتها للمخزون" />
      <InventoryTabs active="/inventory/kits" />
      <Card className="mb-4">
        <form action={addKit} className="grid gap-2 sm:grid-cols-4" data-testid="kit-form">
          <input name="name" required placeholder="اسم العبوة" aria-label="اسم العبوة" className={field} />
          <select name="product_id" required defaultValue="" aria-label="المادة" className={field}><option value="" disabled>المادة…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input name="units" type="number" min="0.01" step="any" required placeholder="وحدات في العبوة" aria-label="وحدات في العبوة" className={field} />
          <Button>إضافة عبوة</Button>
        </form>
      </Card>
      <Card className="p-0 data-table">
        <table className="w-full text-sm" data-testid="kits">
          <thead className="border-b border-line text-right text-muted"><tr><th className="px-4 py-3 font-medium">العبوة</th><th className="px-4 py-3 font-medium">المادة</th><th className="px-4 py-3 font-medium">في العبوة</th><th className="px-4 py-3 font-medium">استلام</th><th className="px-4 py-3" /></tr></thead>
          <tbody>
            {kits.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">لا توجد عبوات.</td></tr>}
            {kits.map((k) => (
              <tr key={k.id} className="border-b border-line last:border-0" data-testid="kit-row">
                <td className="px-4 py-2 font-medium">{k.name}</td>
                <td className="px-4 py-2">{k.product} <span className="text-xs text-muted">(الرصيد {Number(k.quantity)} {k.unit})</span></td>
                <td className="px-4 py-2 tabular-nums">{Number(k.units)} {k.unit}</td>
                <td className="px-4 py-2">
                  <form action={receiveKits} className="flex items-center gap-1">
                    <input type="hidden" name="kit_id" value={k.id} />
                    <input name="count" type="number" min="1" placeholder="عدد" aria-label={`عدد عبوات ${k.name}`} className="w-20 rounded-lg border border-line px-2 py-1 text-sm" />
                    <button className="rounded-lg bg-brand-light px-2 py-1 text-xs font-semibold text-brand-dark">استلام</button>
                  </form>
                </td>
                <td className="px-4 py-2"><form action={deleteKit}><input type="hidden" name="id" value={k.id} /><button className="text-xs text-red-600">حذف</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
