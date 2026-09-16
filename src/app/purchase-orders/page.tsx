import Link from "next/link";
import { Plus } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "مسودة",
  ordered: "مطلوب",
  received: "مُستلم",
  cancelled: "ملغى",
};
const statusTone: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  ordered: "bg-amber-50 text-amber-700",
  received: "bg-teal-50 text-brand-dark",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function PurchaseOrdersPage() {
  const rows = await query<any>(
    `select po.id, po.order_date, po.total_amount, po.status, po.reference,
            s.name as supplier, count(i.id)::int as lines
       from purchase_orders po
       left join suppliers s on s.id = po.supplier_id
       left join purchase_order_items i on i.order_id = po.id
      group by po.id, s.name
      order by po.created_at desc limit 200`
  );

  return (
    <div>
      <PageHeader
        title="أوامر الشراء"
        subtitle="طلب الكواشف من الموردين واستلامها"
        action={
          <Button href="/purchase-orders/new">
            <Plus className="size-4" /> أمر جديد
          </Button>
        }
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المورّد</th>
              <th className="px-4 py-3 font-medium">المرجع</th>
              <th className="px-4 py-3 font-medium">البنود</th>
              <th className="px-4 py-3 font-medium">الإجمالي</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">لا أوامر شراء بعد</td></tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3">
                  <Link href={`/purchase-orders/${r.id}`} className="text-brand-dark hover:underline">{r.order_date}</Link>
                </td>
                <td className="px-4 py-3 font-medium">{r.supplier ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{r.reference ?? "—"}</td>
                <td className="px-4 py-3">{r.lines}</td>
                <td className="px-4 py-3">{money(r.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[r.status]}`}>
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
