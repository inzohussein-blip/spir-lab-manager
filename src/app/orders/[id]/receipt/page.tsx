import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { barcodeSvg } from "@/lib/barcode";
import { getLabIdentity } from "@/lib/lab-identity";
import { money } from "@/lib/utils";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const PAY_STATUS: Record<string, string> = {
  unpaid: "غير مدفوع",
  paid: "مدفوع",
  partial: "دفع جزئي",
};
const PAY_METHOD: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة",
  transfer: "تحويل",
};

/** Reception receipt (وصل) — a compact printable slip listing the ordered
 *  tests, their prices, the total, and the payment status. */
export default async function ReceiptPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const order = await queryOne<any>(
    `select o.accession_no, o.order_date, o.total_amount, o.payment_status,
            o.payment_method, p.full_name, p.gender, p.age_years,
            r.name as referrer
       from test_orders o
       join patients p on p.id = o.patient_id
       left join referrers r on r.id = o.referrer_id
      where o.id = $1`,
    [params.id]
  );
  if (!order) notFound();
  const identity = await getLabIdentity();

  const items = await query<{ name_ar: string; price: number }>(
    `select t.name_ar, i.price
       from test_order_items i join test_catalog t on t.id = i.test_id
      where i.order_id = $1
      order by t.name_ar`,
    [params.id]
  );
  const barcode = order.accession_no ? await barcodeSvg(order.accession_no) : "";

  return (
    <div>
      <div className="no-print mb-4 flex gap-2">
        <PrintButton />
        <Button href={`/orders/${params.id}`} variant="ghost">
          فتح الطلب
        </Button>
      </div>

      <div
        id="report-sheet"
        className="mx-auto w-[80mm] rounded-md border border-black bg-white p-4 text-black print:border-0"
      >
        <div className="text-center">
          <div className="text-base font-bold" style={{ color: "#5a2a82" }}>مختبر التحليلات المرضية</div>
          {identity.subtitle && <div className="text-[10px] text-gray-600">{identity.subtitle}</div>}
          <div className="mt-0.5 text-[11px] text-gray-600">وصل استلام طلب فحص</div>
        </div>

        <div className="my-3 border-t border-dashed border-gray-400" />

        <div className="space-y-1 text-[12px]">
          <Row label="المريض" value={order.full_name} />
          <Row
            label="الجنس/العمر"
            value={`${order.gender === "male" ? "ذكر" : order.gender === "female" ? "أنثى" : "—"}${
              order.age_years ? ` · ${order.age_years} سنة` : ""
            }`}
          />
          <Row label="المصدر" value={order.referrer ?? "مريض خارجي"} />
          <Row label="التاريخ" value={String(order.order_date)} />
        </div>

        <div className="my-3 border-t border-dashed border-gray-400" />

        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-gray-500">
              <th className="pb-1 text-right font-medium">الفحص</th>
              <th className="pb-1 text-left font-medium">د.ع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="py-0.5 text-right">{it.name_ar}</td>
                <td className="py-0.5 text-left tabular-nums">{money(it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-gray-400" />

        <div className="flex items-center justify-between text-sm font-bold">
          <span>الإجمالي</span>
          <span className="tabular-nums">{money(order.total_amount)} د.ع</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[12px]">
          <span>حالة الدفع</span>
          <span>
            {PAY_STATUS[order.payment_status] ?? "—"}
            {order.payment_method ? ` · ${PAY_METHOD[order.payment_method] ?? ""}` : ""}
          </span>
        </div>

        <div className="my-3 border-t border-dashed border-gray-400" />

        {barcode && (
          <span className="mt-1 block h-9 w-full" dangerouslySetInnerHTML={{ __html: barcode }} />
        )}
        <div className="text-center font-mono text-[11px]">{order.accession_no}</div>
        {identity.footer && (
          <>
            <div className="my-2 border-t border-dashed border-gray-400" />
            <div className="text-center text-[10px] text-gray-600">{identity.footer}</div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
