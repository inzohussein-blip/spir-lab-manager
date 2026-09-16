import Link from "next/link";
import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد الفحص",
  completed: "مكتمل",
  delivered: "مُسلّم",
};

export default async function OrdersPage() {
  const orders = await query<any>(
    `select o.id, o.order_date, o.status, o.total_amount, p.full_name,
            count(i.id)::int as tests
       from test_orders o
       join patients p on p.id = o.patient_id
       left join test_order_items i on i.order_id = o.id
      group by o.id, p.full_name
      order by o.order_date desc, o.created_at desc
      limit 100`
  );

  return (
    <div>
      <PageHeader title="الفحوصات والنتائج" subtitle="كل طلبات الفحص" />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  لا توجد طلبات بعد
                </td>
              </tr>
            )}
            {orders.map((o: any) => (
              <tr
                key={o.id}
                className="border-b border-line last:border-0 hover:bg-canvas"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/orders/${o.id}`}
                    className="text-brand-dark hover:underline"
                  >
                    {o.order_date}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{o.full_name}</td>
                <td className="px-4 py-3">{o.tests}</td>
                <td className="px-4 py-3">{statusLabel[o.status] ?? o.status}</td>
                <td className="px-4 py-3">{o.total_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
