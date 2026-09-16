import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { recordPayment, updateInvoiceTerms, voidInvoice } from "@/app/actions/invoices";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { PrintButton } from "@/components/PrintButton";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const statusLabel: Record<string, string> = { unpaid: "غير مدفوعة", partial: "مدفوعة جزئياً", paid: "مدفوعة", void: "ملغاة" };

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
          <div className="flex justify-between"><span className="text-muted">المجموع الفرعي</span><span>{money(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted">الخصم</span><span>-{money(inv.discount)}</span></div>
          <div className="flex justify-between"><span className="text-muted">الضريبة ({inv.tax_rate}%)</span><span>{money(inv.tax_amount)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 font-bold"><span>الإجمالي</span><span>{money(inv.total)}</span></div>
          <div className="flex justify-between"><span className="text-muted">المدفوع</span><span>{money(inv.paid)}</span></div>
          <div className={`flex justify-between font-semibold ${balance > 0 ? "text-red-600" : "text-brand-dark"}`}>
            <span>المتبقّي</span><span>{money(balance)}</span>
          </div>
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
