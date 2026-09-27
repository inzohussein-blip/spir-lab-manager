import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { barcodeSvg } from "@/lib/barcode";
import { setOrderStatus } from "@/app/actions/orders";
import { createInvoiceFromOrder } from "@/app/actions/invoices";
import { PageHeader, Button } from "@/components/ui/primitives";
import { AiAssistant } from "@/components/AiAssistant";
import { ResultEntry } from "@/components/ResultEntry";
import { PaymentBadge } from "@/components/PaymentBadge";
import { QuickPay } from "@/components/QuickPay";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const order = await queryOne<any>(
    `select o.*, p.full_name from test_orders o
       join patients p on p.id = o.patient_id where o.id = $1`,
    [params.id]
  );
  if (!order) notFound();

  const items = await query<any>(
    `select i.id as item_id, i.test_id, t.name_ar, t.unit, t.is_special,
            t.normal_low, t.normal_high,
            r.value_numeric, r.value_text, r.flag,
            r.physical_inspection, r.microscopic
       from test_order_items i
       join test_catalog t on t.id = i.test_id
       left join test_results r on r.order_item_id = i.id
      where i.order_id = $1
      order by t.name_ar`,
    [params.id]
  );

  const invoice = await queryOne<{ id: string }>(
    `select id from invoices where order_id = $1 and status <> 'void' limit 1`,
    [params.id]
  );

  const barcode = order.accession_no ? await barcodeSvg(order.accession_no) : "";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`فحوصات: ${order.full_name}`}
        subtitle={`التاريخ: ${order.order_date}${order.accession_no ? ` · رقم العيّنة: ${order.accession_no}` : ""}`}
        action={
          <div className="flex gap-2">
            <Button href={`/orders/${order.id}/report`} variant="ghost">
              <FileText className="size-4" /> التقرير / الطباعة
            </Button>
            <Button href={`/orders/${order.id}/label`} variant="ghost">
              ملصق العيّنة
            </Button>
            <Button href={`/orders/${order.id}/receipt`} variant="ghost">
              الوصل
            </Button>
            {invoice ? (
              <Button href={`/invoices/${invoice.id}`} variant="ghost">
                الفاتورة
              </Button>
            ) : (
              <form action={createInvoiceFromOrder.bind(null, order.id)}>
                <Button variant="ghost">إنشاء فاتورة</Button>
              </form>
            )}
            <form action={setOrderStatus}>
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="status" value="completed" />
              <Button>إنهاء الطلب</Button>
            </form>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {barcode && (
          <div className="inline-flex flex-col items-center rounded-lg border border-line bg-surface p-2">
            <span className="h-8 w-48" dangerouslySetInnerHTML={{ __html: barcode }} />
            <span className="font-mono text-xs text-muted">{order.accession_no}</span>
          </div>
        )}
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <PaymentBadge status={order.payment_status} />
            <span className="text-muted">الإجمالي:</span>
            <b className="tabular-nums">{money(order.total_amount)} د.ع</b>
          </div>
          {invoice ? (
            <span className="text-xs text-muted">الدفع يُدار من الفاتورة</span>
          ) : (
            <QuickPay
              orderId={order.id}
              status={order.payment_status}
              method={order.payment_method}
            />
          )}
        </div>
      </div>

      {(() => {
        const done = items.filter(
          (it: any) =>
            it.value_numeric != null || it.value_text != null ||
            it.physical_inspection != null || it.microscopic != null
        ).length;
        return (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
            <span className="font-medium">
              إدخال النتائج: <b className="text-brand-dark">{done}</b> / {items.length}
            </span>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="font-medium text-ink">دلالات النتائج:</span>
              <span className="inline-flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-red-50 text-[10px] font-bold text-red-600">H</span> مرتفع</span>
              <span className="inline-flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-blue-50 text-[10px] font-bold text-blue-600">L</span> منخفض</span>
              <span className="inline-flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-teal-50 text-[10px] font-bold text-brand-dark">N</span> طبيعي</span>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col gap-4">
        {items.map((it: any) => (
          <ResultEntry key={it.item_id} item={it} orderId={order.id} patientId={order.patient_id} />
        ))}

        <AiAssistant orderId={order.id} />
      </div>
    </div>
  );
}
