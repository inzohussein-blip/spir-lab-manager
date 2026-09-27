import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { receivePurchaseOrder, cancelPurchaseOrder } from "@/app/actions/purchasing";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "مسودة", ordered: "مطلوب", received: "مُستلم", cancelled: "ملغى",
};

export default async function PurchaseOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const po = await queryOne<any>(
    `select po.*, s.name as supplier from purchase_orders po
       left join suppliers s on s.id = po.supplier_id where po.id = $1`,
    [params.id]
  );
  if (!po) notFound();

  const lines = await query<any>(
    `select coalesce(pr.name, i.description) as name, i.quantity, i.unit_price,
            (i.quantity * i.unit_price) as amount, i.product_id
       from purchase_order_items i
       left join products pr on pr.id = i.product_id
      where i.order_id = $1`,
    [params.id]
  );

  const receivable = po.status === "ordered" || po.status === "draft";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`أمر شراء · ${po.order_date}`}
        subtitle={`${po.supplier ?? "بدون مورّد"} · ${statusLabel[po.status]}${po.reference ? ` · ${po.reference}` : ""}`}
        action={
          receivable && (
            <div className="flex gap-2">
              <form action={cancelPurchaseOrder}>
                <input type="hidden" name="po_id" value={po.id} />
                <Button variant="ghost">إلغاء</Button>
              </form>
              <form action={receivePurchaseOrder}>
                <input type="hidden" name="po_id" value={po.id} />
                <Button>استلام (يزيد المخزون)</Button>
              </form>
            </div>
          )
        }
      />

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">المادة</th>
              <th className="px-4 py-2 font-medium">الكمية</th>
              <th className="px-4 py-2 font-medium">سعر الوحدة</th>
              <th className="px-4 py-2 font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any, i: number) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium">{l.name ?? "—"}</td>
                <td className="px-4 py-2">{l.quantity}</td>
                <td className="px-4 py-2">{money(l.unit_price)}</td>
                <td className="px-4 py-2">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-bold">
              <td className="px-4 py-2" colSpan={3}>الإجمالي</td>
              <td className="px-4 py-2">{money(po.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {po.status === "received" && (
        <p className="mt-3 text-sm text-brand-dark">
          ✓ تم الاستلام في {String(po.received_at).slice(0, 10)} وأُضيفت الكميات للمخزون.
        </p>
      )}
    </div>
  );
}
