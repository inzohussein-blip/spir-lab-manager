import Link from "next/link";
import { ReceiptText, Coins, Wallet } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, StatTile } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئياً",
  paid: "مدفوعة",
  void: "ملغاة",
};
const statusTone: Record<string, string> = {
  unpaid: "bg-red-50 text-red-600",
  partial: "bg-amber-50 text-amber-700",
  paid: "bg-teal-50 text-brand-dark",
  void: "bg-gray-100 text-gray-500",
};

export default async function InvoicesPage(
  props: {
    searchParams: Promise<{ q?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "";

  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(inv.invoice_no ilike $${params.length} or p.full_name ilike $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`inv.status = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const [rows, totals] = await Promise.all([
    query<any>(
      `select inv.id, inv.invoice_no, inv.invoice_date, inv.total, inv.paid, inv.status,
              p.full_name
         from invoices inv
         left join patients p on p.id = inv.patient_id
         ${whereSql}
        order by inv.created_at desc limit 200`,
      params
    ),
    queryOne<any>(
      `select
         coalesce(sum(total) filter (where status <> 'void'),0) as billed,
         coalesce(sum(paid) filter (where status <> 'void'),0) as collected,
         coalesce(sum((total - paid)) filter (where status in ('unpaid','partial')),0) as receivable
       from invoices`
    ),
  ]);

  return (
    <div>
      <PageHeader title="الفواتير" subtitle="فوترة المرضى والمدفوعات" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="إجمالي الفواتير" value={`${money(totals?.billed)} د.ع`} tone="neutral" icon={<ReceiptText className="size-5" />} />
        <StatTile label="المُحصّل" value={`${money(totals?.collected)} د.ع`} icon={<Coins className="size-5" />} />
        <StatTile
          label="المستحق (مدينون)"
          value={`${money(totals?.receivable)} د.ع`}
          tone={Number(totals?.receivable) > 0 ? "warn" : "brand"}
          icon={<Wallet className="size-5" />}
        />
      </div>

      <Card className="mb-4">
        <form className="flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="رقم الفاتورة أو اسم المريض…"
            className="min-w-48 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <select name="status" defaultValue={status} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <option value="">كل الحالات</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            فلترة
          </button>
          <Link href="/invoices" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">مسح</Link>
        </form>
      </Card>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">رقم الفاتورة</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">الإجمالي</th>
              <th className="px-4 py-3 font-medium">المدفوع</th>
              <th className="px-4 py-3 font-medium">المتبقّي</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">لا توجد فواتير</td></tr>
            )}
            {rows.map((r: any) => {
              const balance = Math.max(0, Number(r.total) - Number(r.paid));
              return (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/invoices/${r.id}`} className="text-brand-dark hover:underline">{r.invoice_no}</Link>
                </td>
                <td className="px-4 py-3">{r.invoice_date}</td>
                <td className="px-4 py-3 font-medium">{r.full_name ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{money(r.total)}</td>
                <td className="px-4 py-3 tabular-nums">{money(r.paid)}</td>
                <td className={`px-4 py-3 tabular-nums ${balance > 0 && r.status !== "void" ? "text-red-600" : "text-muted"}`}>
                  {money(balance)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[r.status]}`}>
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
