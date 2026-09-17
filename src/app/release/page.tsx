import Link from "next/link";
import { FileText, PackageCheck, Wallet } from "lucide-react";
import { query } from "@/lib/db";
import { setOrderStatus } from "@/app/actions/orders";
import { PageHeader, Card, StatTile } from "@/components/ui/primitives";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PaymentBadge } from "@/components/PaymentBadge";
import { QuickPay } from "@/components/QuickPay";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Release/delivery desk (floor 1): completed orders ready to print, send, and
 *  hand over. Marking delivered moves them out of the queue. */
export default async function ReleasePage() {
  const rows = await query<any>(
    `select o.id, o.accession_no, o.order_date, o.payment_status, o.payment_method,
            o.total_amount, p.full_name, p.phone,
            count(i.id)::int as tests,
            exists (select 1 from invoices v where v.order_id = o.id and v.status <> 'void') as has_invoice
       from test_orders o
       join patients p on p.id = o.patient_id
       left join test_order_items i on i.order_id = o.id
      where o.status = 'completed'
      group by o.id, p.full_name, p.phone
      order by o.order_date desc
      limit 200`
  );

  const unpaid = rows.filter((o: any) => o.payment_status !== "paid");
  const dueTotal = unpaid.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="تسليم النتائج"
        subtitle="التقارير المكتملة الجاهزة للطباعة والإرسال والتسليم"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="جاهزة للتسليم" value={rows.length} icon={<PackageCheck className="size-5" />} />
        <StatTile
          label="بانتظار التحصيل"
          value={unpaid.length}
          tone={unpaid.length ? "warn" : "brand"}
          icon={<Wallet className="size-5" />}
        />
        <StatTile
          label="مبالغ مستحقة"
          value={`${money(dueTotal)} ر.س`}
          tone={dueTotal > 0 ? "danger" : "brand"}
        />
      </div>
      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">رقم العيّنة</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium">الدفع</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">لا نتائج بانتظار التسليم</td></tr>
            )}
            {rows.map((o: any) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-muted">{o.accession_no ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{o.full_name}</td>
                <td className="px-4 py-3">{o.tests}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <PaymentBadge status={o.payment_status} />
                    {o.payment_status !== "paid" && !o.has_invoice && (
                      <QuickPay orderId={o.id} status={o.payment_status} method={o.payment_method} />
                    )}
                  </div>
                </td>
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
