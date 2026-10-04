import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { InventoryTabs } from "@/components/InventoryTabs";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  test: "فحص", purchase: "شراء", adjustment: "تعديل", reconcile: "تسوية", stocktake: "جرد", kit: "استلام عبوات", expiry: "انتهاء صلاحية", restock: "تعبئة",
};

/** «حركة المخزون»: every change of every item, newest first. */
export default async function MovesPage(props: { searchParams: Promise<{ p?: string; r?: string }> }) {
  const sp = await props.searchParams;
  const products = await query<any>(`select id, name from products order by name`);
  const pid = products.some((p) => p.id === sp.p) ? sp.p! : "";
  const reason = sp.r && /^[a-z_]{1,20}$/.test(sp.r) ? sp.r : "";
  const rows = await query<any>(
    `select m.created_at::text as at, m.change_qty, m.reason, p.name, p.unit
       from stock_movements m join products p on p.id = m.product_id
      where ($1 = '' or m.product_id::text = $1) and ($2 = '' or m.reason = $2)
      order by m.created_at desc limit 500`,
    [pid, reason]
  );
  return (
    <div>
      <PageHeader title="حركة المخزون" subtitle="كل إضافة وصرف وجرد لكل مادة" />
      <InventoryTabs active="/inventory/moves" />
      <form className="mb-3 flex flex-wrap gap-2">
        <select name="p" defaultValue={pid} aria-label="المادة" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="">كل المواد</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="r" defaultValue={reason} aria-label="السبب" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="">كل الحركات</option>{Object.entries(REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-lg border border-line px-3 py-2 text-sm">عرض</button>
      </form>
      <Card className="p-0 data-table">
        <table className="w-full text-sm" data-testid="moves">
          <thead className="border-b border-line text-right text-muted"><tr><th className="px-4 py-3 font-medium">الوقت</th><th className="px-4 py-3 font-medium">المادة</th><th className="px-4 py-3 font-medium">التغيير</th><th className="px-4 py-3 font-medium">السبب</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">لا توجد حركات.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0" data-testid="move-row">
                <td className="px-4 py-2 text-xs text-muted" dir="ltr">{r.at.slice(0, 16)}</td>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className={`px-4 py-2 font-semibold tabular-nums ${Number(r.change_qty) < 0 ? "text-red-600" : "text-teal-700"}`} dir="ltr">{Number(r.change_qty) > 0 ? "+" : ""}{Number(r.change_qty)} {r.unit}</td>
                <td className="px-4 py-2">{REASON[r.reason] ?? r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
