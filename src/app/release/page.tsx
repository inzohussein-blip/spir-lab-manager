import Link from "next/link";
import { FileText } from "lucide-react";
import { query } from "@/lib/db";
import { setOrderStatus } from "@/app/actions/orders";
import { PageHeader, Card } from "@/components/ui/primitives";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export const dynamic = "force-dynamic";

/** Release/delivery desk (floor 1): completed orders ready to print, send, and
 *  hand over. Marking delivered moves them out of the queue. */
export default async function ReleasePage() {
  const rows = await query<any>(
    `select o.id, o.accession_no, o.order_date, p.full_name, p.phone,
            count(i.id)::int as tests
       from test_orders o
       join patients p on p.id = o.patient_id
       left join test_order_items i on i.order_id = o.id
      where o.status = 'completed'
      group by o.id, p.full_name, p.phone
      order by o.order_date desc
      limit 200`
  );

  return (
    <div>
      <PageHeader
        title="تسليم النتائج"
        subtitle="التقارير المكتملة الجاهزة للطباعة والإرسال والتسليم"
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">رقم العيّنة</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">لا نتائج بانتظار التسليم</td></tr>
            )}
            {rows.map((o: any) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-muted">{o.accession_no ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{o.full_name}</td>
                <td className="px-4 py-3">{o.tests}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/orders/${o.id}/report`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas">
                      <FileText className="size-3.5" /> التقرير
                    </Link>
                    {o.phone && <WhatsAppButton orderId={o.id} />}
                    <form action={setOrderStatus}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="delivered" />
                      <button className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
                        تم التسليم
                      </button>
                    </form>
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
