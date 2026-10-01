import Link from "next/link";
import { ChevronRight, ChevronLeft, Stethoscope, Percent } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Card, StatTile, EmptyState } from "@/components/ui/primitives";
import { PrintButton } from "@/components/PrintButton";
import { money, cn } from "@/lib/utils";
import { setCommission } from "@/app/actions/finance";
import { today, isMonth, addMonths } from "@/lib/finance";
import { getLabIdentity, labName } from "@/lib/lab-identity";

export const dynamic = "force-dynamic";

/** What a referral was billed: its invoice (not voided), else the order's own total. */
const BILLED = `coalesce((select sum(i.total) from invoices i where i.order_id = o.id and i.status <> 'void'), o.total_amount)`;

/** «حصص الأطباء المحيلين»: each doctor's referrals in a month, what they were billed, and the
 *  doctor's share at their percent — with a statement to print for one doctor. */
export default async function CommissionsPage(props: { searchParams: Promise<{ m?: string; r?: string }> }) {
  const sp = await props.searchParams;
  const now = await today();
  const month = isMonth(sp.m) ? sp.m! : now.slice(0, 7);
  const rows = await query<{ id: string; name: string; clinic: string | null; commission_pct: number; orders: number; billed: number }>(
    `select r.id, r.name, r.clinic, r.commission_pct,
            count(o.id)::int as orders, coalesce(sum(${BILLED}), 0) as billed
       from referrers r
       left join test_orders o on o.referrer_id = r.id and to_char(o.order_date, 'YYYY-MM') = $1
      group by r.id order by billed desc, r.name`,
    [month]
  );
  const share = (r: { billed: number; commission_pct: number }) => Math.round(Number(r.billed) * Number(r.commission_pct) / 100);
  const pick = rows.find((r) => r.id === sp.r) ?? null;
  const detail = pick ? await query<{ id: string; order_date: string; accession_no: string | null; full_name: string | null; billed: number }>(
    `select o.id, o.order_date::text, o.accession_no, p.full_name, ${BILLED} as billed
       from test_orders o left join patients p on p.id = o.patient_id
      where o.referrer_id = $1 and to_char(o.order_date, 'YYYY-MM') = $2 order by o.order_date`,
    [pick.id, month]
  ) : [];
  const lab = labName(await getLabIdentity());
  const totalShare = rows.reduce((s, r) => s + share(r), 0);
  const q = (m: string, r?: string) => `/referrers/commissions?m=${m}${r ? `&r=${r}` : ""}`;

  return (
    <div data-testid="commissions">
      <div className={cn(pick && "print:hidden")}>
        <PageHeader title="حصص الأطباء المحيلين" subtitle="إحالات كل طبيب في الشهر، وما فُوتر عليها، وحصته بنسبته" />
        <div className="no-print mb-4 flex items-center gap-1">
          <Link href={q(addMonths(month, -1))} className="grid size-9 place-items-center rounded-lg border border-line bg-surface hover:bg-canvas" aria-label="الشهر السابق"><ChevronRight className="size-4" /></Link>
          <span className="px-2 font-semibold tabular-nums" dir="ltr">{month}</span>
          {month < now.slice(0, 7) && <Link href={q(addMonths(month, 1))} className="grid size-9 place-items-center rounded-lg border border-line bg-surface hover:bg-canvas" aria-label="الشهر التالي"><ChevronLeft className="size-4" /></Link>}
        </div>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatTile label="الإحالات" value={rows.reduce((s, r) => s + r.orders, 0)} tone="neutral" icon={<Stethoscope className="size-5" />} />
          <StatTile label="المفوتر عليها" value={`${money(rows.reduce((s, r) => s + Number(r.billed), 0))} د.ع`} tone="brand" />
          <StatTile label="مجموع الحصص" value={`${money(totalShare)} د.ع`} tone="warn" icon={<Percent className="size-5" />} />
        </div>
        <Card className="p-0">
          {rows.length === 0 ? <EmptyState icon={<Stethoscope className="size-6" />} title="لا أطباء بعد" hint="أضف الأطباء من «الأطباء المُحيلون»." /> : (
            <table className="w-full text-sm" data-testid="commissions-list">
              <thead className="border-b border-line text-right text-muted">
                <tr><th className="px-5 py-2.5 font-medium">الطبيب</th><th className="px-3 py-2.5 font-medium">الإحالات</th><th className="px-3 py-2.5 font-medium">المفوتر</th><th className="px-3 py-2.5 font-medium">النسبة</th><th className="px-3 py-2.5 font-medium">الحصة</th><th className="no-print px-5 py-2.5" /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("border-b border-line last:border-0", pick?.id === r.id && "bg-brand-light/40")} data-referrer={r.name}>
                    <td className="px-5 py-2.5 font-medium">{r.name}{r.clinic && <div className="text-[11px] font-normal text-muted">{r.clinic}</div>}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.orders}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(r.billed)}</td>
                    <td className="px-3 py-2.5">
                      <form action={setCommission} className="no-print flex items-center gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="commission_pct" type="number" min="0" max="100" step="0.5" defaultValue={Number(r.commission_pct)} aria-label={`نسبة ${r.name}`}
                          className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand" />
                        <span className="text-xs text-muted">%</span>
                        <button className="rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas">حفظ</button>
                      </form>
                      <span className="hidden print:inline">{Number(r.commission_pct)}%</span>
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums">{money(share(r))}</td>
                    <td className="no-print px-5 py-2.5 text-left"><Link href={q(month, r.id)} className="text-xs text-brand-dark hover:underline">الكشف</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {pick && (
        <Card className="mt-6" >
          <div className="flex flex-wrap items-start justify-between gap-3" data-testid="commission-statement">
            <div>
              <div className="text-xs text-muted">{lab}</div>
              <h2 className="text-lg font-bold">كشف حصة الطبيب {pick.name}</h2>
              <div className="text-sm text-muted">الشهر <span dir="ltr">{month}</span>{pick.clinic ? ` — ${pick.clinic}` : ""}</div>
            </div>
            <div className="no-print flex gap-2"><PrintButton /><Link href={q(month)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">إغلاق</Link></div>
          </div>
          {detail.length === 0 ? <p className="mt-4 text-sm text-muted">لا إحالات في هذا الشهر.</p> : (
            <table className="mt-4 w-full text-sm">
              <thead className="border-b border-line text-right text-muted"><tr><th className="py-2 font-medium">التاريخ</th><th className="py-2 font-medium">المريض</th><th className="py-2 font-medium">رقم العينة</th><th className="py-2 font-medium">المفوتر</th></tr></thead>
              <tbody>
                {detail.map((d) => (
                  <tr key={d.id} className="border-b border-line">
                    <td className="py-1.5 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>{d.order_date}</td>
                    <td className="py-1.5">{d.full_name ?? "—"}</td>
                    <td className="py-1.5 text-muted">{d.accession_no ?? "—"}</td>
                    <td className="py-1.5 tabular-nums">{money(d.billed)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} className="pt-3 font-semibold">المجموع ({detail.length} إحالة)</td><td className="pt-3 font-semibold tabular-nums">{money(pick.billed)}</td></tr>
                <tr><td colSpan={3} className="font-bold">الحصة ({Number(pick.commission_pct)}%)</td><td className="font-bold tabular-nums" data-testid="commission-share">{money(share(pick))}</td></tr>
              </tfoot>
            </table>
          )}
          <div className="mt-10 hidden grid-cols-2 gap-10 text-center text-sm print:grid">
            <div className="border-t border-gray-400 pt-1">توقيع المختبر</div>
            <div className="border-t border-gray-400 pt-1">توقيع الطبيب</div>
          </div>
        </Card>
      )}
    </div>
  );
}
