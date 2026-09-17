import Link from "next/link";
import { Search, Download } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { PaymentBadge } from "@/components/PaymentBadge";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد الفحص",
  completed: "مكتمل",
  delivered: "مُسلّم",
};

const paymentLabel: Record<string, string> = {
  unpaid: "غير مدفوع",
  partial: "دفع جزئي",
  paid: "مدفوع",
};

const STATUSES = ["", "pending", "in_progress", "completed", "delivered"];
const PAYMENTS = ["", "unpaid", "partial", "paid"];

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; payment?: string; from?: string; to?: string };
}) {
  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "";
  const payment = searchParams.payment || "";
  const from = searchParams.from || "";
  const to = searchParams.to || "";

  // Build a filtered query (AuraLIMS-style registry search).
  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.full_name ilike $${params.length} or o.accession_no ilike $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  if (payment) {
    params.push(payment);
    where.push(`o.payment_status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`o.order_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`o.order_date <= $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  // Preserve the active filters when exporting to CSV.
  const exportQs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ q, status, payment, from, to }).filter(([, v]) => v)
    )
  ).toString();

  const orders = await query<any>(
    `select o.id, o.order_date, o.status, o.payment_status, o.total_amount, o.accession_no,
            p.full_name, count(i.id)::int as tests
       from test_orders o
       join patients p on p.id = o.patient_id
       left join test_order_items i on i.order_id = o.id
       ${whereSql}
      group by o.id, p.full_name
      order by o.order_date desc, o.created_at desc
      limit 200`,
    params
  );

  return (
    <div>
      <PageHeader
        title="سجل العيّنات والفحوصات"
        subtitle="بحث وفلترة متقدّمة على نمط سجلّات LIMS"
      />

      {/* Advanced filter bar */}
      <Card className="mb-4">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 lg:col-span-2">
            <Search className="size-4 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="الاسم أو رقم العيّنة…"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
          <select name="status" defaultValue={status} className={field}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "" ? "كل الحالات" : statusLabel[s]}
              </option>
            ))}
          </select>
          <select name="payment" defaultValue={payment} className={field}>
            {PAYMENTS.map((s) => (
              <option key={s} value={s}>
                {s === "" ? "كل حالات الدفع" : paymentLabel[s]}
              </option>
            ))}
          </select>
          <input name="from" type="date" defaultValue={from} className={field} aria-label="من تاريخ" />
          <input name="to" type="date" defaultValue={to} className={field} aria-label="إلى تاريخ" />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              تطبيق الفلترة
            </button>
            <Link href="/orders" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
              مسح
            </Link>
            <a
              href={`/orders/export${exportQs ? `?${exportQs}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas"
            >
              <Download className="size-4" /> تصدير CSV
            </a>
            <span className="ms-auto self-center text-xs text-muted">
              النتائج: {orders.length}
            </span>
          </div>
        </form>
      </Card>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">رقم العيّنة</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الفحوصات</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">الدفع</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  لا توجد نتائج مطابقة
                </td>
              </tr>
            )}
            {orders.map((o: any) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {o.accession_no ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="text-brand-dark hover:underline">
                    {o.order_date}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{o.full_name}</td>
                <td className="px-4 py-3">{o.tests}</td>
                <td className="px-4 py-3">{statusLabel[o.status] ?? o.status}</td>
                <td className="px-4 py-3"><PaymentBadge status={o.payment_status} /></td>
                <td className="px-4 py-3 tabular-nums">{money(o.total_amount)} ر.س</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
