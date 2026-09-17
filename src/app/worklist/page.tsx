import Link from "next/link";
import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Lab bench worklist (floor 2): incoming orders awaiting results, oldest first
 *  (rush-hour order). Shows how many results are still pending per order. */
export default async function WorklistPage() {
  const rows = await query<any>(
    `select o.id, o.accession_no, o.order_date, o.created_at, o.status,
            p.full_name,
            count(i.id)::int as tests,
            count(i.id) filter (where r.id is null)::int as pending
       from test_orders o
       join patients p on p.id = o.patient_id
       left join test_order_items i on i.order_id = o.id
       left join test_results r on r.order_item_id = i.id
      where o.status in ('pending', 'in_progress')
      group by o.id, p.full_name
      order by o.created_at asc
      limit 200`
  );

  return (
    <div>
      <PageHeader
        title="طاولة المختبر"
        subtitle="الطلبات الواردة بانتظار إدخال النتائج (الأقدم أولاً)"
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الوقت</th>
              <th className="px-4 py-3 font-medium">رقم العيّنة</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium">المتبقّي</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">لا طلبات قيد الانتظار ✅</td></tr>
            )}
            {rows.map((o: any) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 text-muted whitespace-nowrap">{String(o.created_at).slice(11, 16)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{o.accession_no ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{o.full_name}</td>
                <td className="px-4 py-3">{o.tests}</td>
                <td className="px-4 py-3">
                  {o.pending > 0 ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{o.pending} متبقٍ</span>
                  ) : (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-brand-dark">مكتمل</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Link href={`/orders/${o.id}`} className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
                      إدخال النتائج
                    </Link>
                    <Link href={`/orders/${o.id}/label`} className="rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">
                      ملصق
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
