import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { barcodeSvg } from "@/lib/barcode";
import { saveResult, setOrderStatus } from "@/app/actions/orders";
import { PageHeader, Card, Button, FlagChip } from "@/components/ui/primitives";
import { AiAssistant } from "@/components/AiAssistant";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
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
            <form action={setOrderStatus}>
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="status" value="completed" />
              <Button>إنهاء الطلب</Button>
            </form>
          </div>
        }
      />

      {barcode && (
        <div className="mb-4 inline-flex flex-col items-center rounded-lg border border-line bg-surface p-2">
          <span className="h-8 w-48" dangerouslySetInnerHTML={{ __html: barcode }} />
          <span className="font-mono text-xs text-muted">{order.accession_no}</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((it: any) => (
          <Card key={it.item_id}>
            <form action={saveResult} className="flex flex-col gap-3">
              <input type="hidden" name="order_item_id" value={it.item_id} />
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="patient_id" value={order.patient_id} />
              <input type="hidden" name="test_id" value={it.test_id} />

              <div className="flex items-center justify-between">
                <div className="font-semibold">{it.name_ar}</div>
                <div className="text-sm">
                  <FlagChip flag={it.flag} />
                </div>
              </div>

              {it.is_special ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <fieldset className="rounded-lg border border-line p-3">
                    <legend className="px-1 text-xs text-muted">
                      الفحص العيني (Physical)
                    </legend>
                    <div className="flex flex-col gap-2">
                      <input name="phys_color" placeholder="اللون" defaultValue={it.physical_inspection?.color ?? ""} className={field} />
                      <input name="phys_appearance" placeholder="المظهر" defaultValue={it.physical_inspection?.appearance ?? ""} className={field} />
                      <input name="phys_sediment" placeholder="الرواسب" defaultValue={it.physical_inspection?.sediment ?? ""} className={field} />
                    </div>
                  </fieldset>
                  <fieldset className="rounded-lg border border-line p-3">
                    <legend className="px-1 text-xs text-muted">
                      الفحص المجهري (Microscopic)
                    </legend>
                    <div className="flex flex-col gap-2">
                      <input name="mic_rbc" placeholder="RBCs كرات الدم الحمراء" defaultValue={it.microscopic?.rbc ?? ""} className={field} />
                      <input name="mic_pus" placeholder="Pus cells الخلايا القيحية" defaultValue={it.microscopic?.pus_cells ?? ""} className={field} />
                      <input name="mic_epithelial" placeholder="الخلايا الطلائية" defaultValue={it.microscopic?.epithelial ?? ""} className={field} />
                      <input name="mic_crystals" placeholder="الأملاح / البلورات" defaultValue={it.microscopic?.crystals ?? ""} className={field} />
                      <input name="mic_mucus" placeholder="المخاط" defaultValue={it.microscopic?.mucus ?? ""} className={field} />
                    </div>
                  </fieldset>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    name="value_numeric"
                    type="number"
                    step="any"
                    placeholder="النتيجة الرقمية"
                    defaultValue={it.value_numeric ?? ""}
                    className={field}
                  />
                  <span className="whitespace-nowrap text-sm text-muted">
                    {it.unit} · النطاق {it.normal_low ?? "—"}–{it.normal_high ?? "—"}
                  </span>
                </div>
              )}

              <div>
                <Button>حفظ النتيجة</Button>
              </div>
            </form>
          </Card>
        ))}

        <AiAssistant orderId={order.id} />
      </div>
    </div>
  );
}
