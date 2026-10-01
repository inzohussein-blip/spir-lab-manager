import Link from "next/link";
import { HandCoins, Users, Clock, MessageCircle } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Card, StatTile, EmptyState } from "@/components/ui/primitives";
import { PrintButton } from "@/components/PrintButton";
import { money, cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { getLabIdentity, labName } from "@/lib/lab-identity";

/** An Iraqi number as WhatsApp wants it (07xxxxxxxxx → 9647xxxxxxxxx). */
const intl = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.startsWith("0") ? "964" + d.slice(1) : d; };

export const dynamic = "force-dynamic";

interface Due { patient_id: string | null; full_name: string | null; phone: string | null; invoices: number; total: number; paid: number; due: number; oldest: string; days: number; ids: string[]; nos: string[] }

/** «الديون»: what patients still owe (unpaid and part-paid invoices), by patient, oldest first. */
export default async function DebtsPage(props: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await props.searchParams;
  const q = (sp.q || "").trim();
  const sort = sp.sort === "amount" ? "amount" : "age";
  const params: unknown[] = [];
  let where = `inv.status in ('unpaid', 'partial') and inv.total - inv.paid > 0`;
  if (q) { params.push(`%${q}%`); where += ` and (p.full_name ilike $1 or p.phone ilike $1 or inv.invoice_no ilike $1)`; }
  const rows = await query<Due>(
    `select inv.patient_id, p.full_name, p.phone,
            count(*)::int as invoices, sum(inv.total) as total, sum(inv.paid) as paid, sum(inv.total - inv.paid) as due,
            min(inv.invoice_date)::text as oldest, (current_date - min(inv.invoice_date))::int as days,
            array_agg(inv.id::text order by inv.invoice_date) as ids, array_agg(coalesce(inv.invoice_no, '—') order by inv.invoice_date) as nos
       from invoices inv
       left join patients p on p.id = inv.patient_id
      where ${where}
      group by inv.patient_id, p.full_name, p.phone
      order by ${sort === "amount" ? "sum(inv.total - inv.paid) desc" : "min(inv.invoice_date) asc"}
      limit 500`,
    params
  );
  const lab = labName(await getLabIdentity());
  const totalDue = rows.reduce((s, r) => s + Number(r.due), 0);
  const old = rows.filter((r) => r.days > 30);

  return (
    <div data-testid="debts">
      <PageHeader title="الديون" subtitle="ما بقي على المرضى من فواتير غير مدفوعة أو مدفوعة جزئياً" action={<PrintButton />} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile label="مجموع الديون" value={`${money(totalDue)} د.ع`} tone={totalDue ? "danger" : "brand"} icon={<HandCoins className="size-5" />} />
        <StatTile label="عدد المرضى" value={rows.length} tone="neutral" icon={<Users className="size-5" />} />
        <StatTile label="أقدم من 30 يوماً" value={old.length} tone={old.length ? "warn" : "neutral"} icon={<Clock className="size-5" />} hint={old.length ? `${money(old.reduce((s, r) => s + Number(r.due), 0))} د.ع` : undefined} />
      </div>

      <form className="no-print mb-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="بحث بالاسم أو الهاتف أو رقم الفاتورة…" aria-label="بحث" className="min-w-56 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        <select name="sort" defaultValue={sort} aria-label="الترتيب" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
          <option value="age">الأقدم أولاً</option>
          <option value="amount">الأكبر مبلغاً</option>
        </select>
        <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">عرض</button>
      </form>

      <Card className="p-0">
        {rows.length === 0 ? <EmptyState icon={<HandCoins className="size-6" />} title={q ? "لا نتائج" : "لا ديون"} hint={q ? undefined : "كل الفواتير مدفوعة."} /> : (
          <table className="w-full text-sm" data-testid="debts-list">
            <thead className="border-b border-line text-right text-muted">
              <tr><th className="px-5 py-2.5 font-medium">المريض</th><th className="px-3 py-2.5 font-medium">الفواتير</th><th className="px-3 py-2.5 font-medium">المبلغ</th><th className="px-3 py-2.5 font-medium">المدفوع</th><th className="px-3 py-2.5 font-medium">الباقي</th><th className="px-3 py-2.5 font-medium">منذ</th><th className="no-print px-5 py-2.5" /></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const msg = `السلام عليكم ${r.full_name ?? ""}، نذكّركم بمبلغ ${money(r.due)} د.ع متبقٍ لدى ${lab}. شكراً لكم.`;
                return (
                  <tr key={r.patient_id ?? i} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5">
                      {r.patient_id ? <Link href={`/patients/${r.patient_id}`} className="font-medium hover:underline">{r.full_name}</Link> : <span className="font-medium">{r.full_name ?? "—"}</span>}
                      {r.phone && <div className="text-[11px] text-muted" dir="ltr" style={{ textAlign: "right" }}>{r.phone}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.ids.map((id, k) => <Link key={id} href={`/invoices/${id}`} className="rounded-md bg-canvas px-1.5 py-0.5 text-xs hover:underline">{r.nos[k]}</Link>)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{money(r.total)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">{money(r.paid)}</td>
                    <td className="px-3 py-2.5 font-bold tabular-nums text-red-600">{money(r.due)}</td>
                    <td className={cn("px-3 py-2.5 text-xs", r.days > 30 ? "font-semibold text-amber-700" : "text-muted")}>{r.days === 0 ? "اليوم" : `${r.days} يوم`}</td>
                    <td className="no-print px-5 py-2.5 text-left">
                      {r.phone && (
                        <a href={waLink(intl(r.phone), msg)} target="_blank" rel="noreferrer" title="تذكير بواتساب" aria-label="تذكير بواتساب"
                          className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50">
                          <MessageCircle className="size-3.5" /> تذكير
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <p className="no-print mt-3 text-xs text-muted">يُسدَّد الدين من صفحة الفاتورة («تسجيل دفعة»)، فيختفي من هنا ويُحسب في <Link href="/cashbox" className="text-brand-dark hover:underline">الصندوق اليومي</Link>.</p>
    </div>
  );
}
