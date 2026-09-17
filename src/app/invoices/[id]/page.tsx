import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { recordPayment, updateInvoiceTerms, voidInvoice } from "@/app/actions/invoices";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { PrintButton } from "@/components/PrintButton";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const statusLabel: Record<string, string> = { unpaid: "غير مدفوعة", partial: "مدفوعة جزئياً", paid: "مدفوعة", void: "ملغاة" };
const statusTone: Record<string, string> = {
  unpaid: "bg-red-50 text-red-600",
  partial: "bg-amber-50 text-amber-700",
  paid: "bg-teal-50 text-brand-dark",
  void: "bg-gray-100 text-gray-500",
};

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const inv = await queryOne<any>(
    `select inv.*, p.full_name, p.phone from invoices inv
       left join patients p on p.id = inv.patient_id where inv.id = $1`,
    [params.id]
  );
  if (!inv) notFound();

  const [items, payments] = await Promise.all([
    query<any>(`select description, quantity, unit_price, amount from invoice_items where invoice_id=$1`, [params.id]),
    query<any>(`select amount, method, paid_at from payments where invoice_id=$1 order by paid_at desc`, [params.id]),
  ]);
  const balance = Number(inv.total) - Number(inv.paid);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`فاتورة ${inv.invoice_no}`}
        subtitle={`${inv.full_name ?? "—"} · ${inv.invoice_date} · ${statusLabel[inv.status]}`}
        action={
          <div className="no-print flex gap-2">
            <PrintButton />
            {inv.status !== "void" && (
              <form action={voidInvoice}>
                <input type="hidden" name="invoice_id" value={inv.id} />
                <Button variant="ghost">إلغاء</Button>
              </form>
            )}
          </div>
        }
      />

      {/* Printable invoice */}
      <div id="report-sheet" className="rounded-2xl border border-line bg-surface p-6">
        {/* Letterhead */}
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="text-lg font-bold text-brand-dark">مختبر المجمع الطبي</div>
            <div className="text-xs text-muted">فاتورة فحوصات مخبرية</div>
          </div>
          <div className="text-left text-xs">
            <div className="font-mono text-sm font-bold">{inv.invoice_no}</div>
            <div className="text-muted">التاريخ: {inv.invoice_date}</div>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[inv.status]}`}>
              {statusLabel[inv.status]}
            </span>
          </div>
        </div>

        {/* Bill-to */}
        <div className="mb-4 text-sm">
          <span className="text-muted">فاتورة إلى: </span>
          <span className="font-semibold">{inv.full_name ?? "—"}</span>
          {inv.phone && <span className="text-muted"> · ☎ {inv.phone}</span>}
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="py-2 font-medium">البند</th>
              <th className="py-2 font-medium">الكمية</th>
              <th className="py-2 font-medium">السعر</th>
              <th className="py-2 font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="py-2 font-medium">{it.description}</td>
                <td className="py-2">{it.quantity}</td>
                <td className="py-2">{money(it.unit_price)}</td>
                <td className="py-2">{money(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ms-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted">المجموع الفرعي</span><span className="tabular-nums">{money(inv.subtotal)} ر.س</span></div>
          <div className="flex justify-between"><span className="text-muted">الخصم</span><span className="tabular-nums">-{money(inv.discount)} ر.س</span></div>
          <div className="flex justify-between"><span className="text-muted">الضريبة ({inv.tax_rate}%)</span><span className="tabular-nums">{money(inv.tax_amount)} ر.س</span></div>
          <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><span>الإجمالي</span><span className="tabular-nums">{money(inv.total)} ر.س</span></div>
          <div className="flex justify-between"><span className="text-muted">المدفوع</span><span className="tabular-nums">{money(inv.paid)} ر.س</span></div>
          <div className={`flex justify-between font-semibold ${balance > 0 ? "text-red-600" : "text-brand-dark"}`}>
            <span>المتبقّي</span><span className="tabular-nums">{money(balance)} ر.س</span>
          </div>
          {Number(inv.total) > 0 && inv.status !== "void" && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(100, (Number(inv.paid) / Number(inv.total)) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {inv.status !== "void" && (
        <div className="no-print mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="mb-3 text-sm font-semibold">الخصم والضريبة</div>
            <form action={updateInvoiceTerms} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="invoice_id" value={inv.id} />
              <label className="text-xs text-muted">الخصم
                <input name="discount" type="number" step="any" defaultValue={inv.discount} className={field} />
              </label>
              <label className="text-xs text-muted">الضريبة %
                <input name="tax_rate" type="number" step="any" defaultValue={inv.tax_rate} className={field} />
              </label>
              <div className="col-span-2"><Button>تحديث</Button></div>
            </form>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold">تسجيل دفعة</div>
            <form action={recordPayment} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="invoice_id" value={inv.id} />
              <label className="text-xs text-muted">المبلغ
                <input name="amount" type="number" step="any" defaultValue={balance > 0 ? balance : ""} className={field} />
              </label>
              <label className="text-xs text-muted">الطريقة
                <select name="method" className={field}>
                  <option value="cash">نقداً</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل</option>
                </select>
              </label>
              <div className="col-span-2"><Button>تسجيل الدفعة</Button></div>
            </form>
          </Card>
        </div>
      )}

      {payments.length > 0 && (
        <Card className="no-print mt-4">
          <div className="mb-3 text-sm font-semibold">سجل المدفوعات</div>
          <table className="w-full text-sm">
            <tbody>
              {payments.map((p: any, i: number) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2">{String(p.paid_at).slice(0, 10)}</td>
                  <td className="py-2">{p.method === "cash" ? "نقداً" : p.method === "card" ? "بطاقة" : "تحويل"}</td>
                  <td className="py-2 text-left font-medium">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
