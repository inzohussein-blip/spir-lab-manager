import { query, queryOne } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { StaffTabs } from "@/components/StaffTabs";
import { PrintButton } from "@/components/PrintButton";
import { ensureOps } from "@/lib/desk/schema";
import { getLabIdentity, labName } from "@/lib/lab-identity";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** «الرواتب»: each person's month — salary, absences and unpaid leave (a day = salary ÷ 30), advances, net. */
export default async function PayrollPage(props: { searchParams: Promise<{ month?: string }> }) {
  await ensureOps();
  const thisMonth = (await queryOne<{ m: string }>(`select to_char(current_date, 'YYYY-MM') as m`))!.m;
  const q = (await props.searchParams).month ?? "";
  const month = /^\d{4}-\d{2}$/.test(q) ? q : thisMonth;
  const identity = await getLabIdentity();
  const rows = await query<any>(
    `with m as (select ($1 || '-01')::date as a, (($1 || '-01')::date + interval '1 month - 1 day')::date as b)
     select s.id, s.full_name, s.role, s.salary,
            (select count(*) from attendance x where x.staff_id = s.id and x.work_date between m.a and m.b and x.status in ('present','late'))::int as present,
            (select count(*) from attendance x where x.staff_id = s.id and x.work_date between m.a and m.b and x.status = 'late')::int as late,
            (select count(*) from attendance x where x.staff_id = s.id and x.work_date between m.a and m.b and x.status = 'absent')::int as absent,
            coalesce((select sum(least(l.to_date, m.b) - greatest(l.from_date, m.a) + 1) from staff_leaves l
                       where l.staff_id = s.id and not l.paid and l.from_date <= m.b and l.to_date >= m.a), 0)::int as unpaid,
            coalesce((select sum(v.amount) from staff_advances v where v.staff_id = s.id and v.given_on between m.a and m.b), 0) as advances
       from staff s, m where s.is_active order by s.full_name`,
    [month]
  );
  const calc = rows.map((r) => {
    const salary = Number(r.salary) || 0;
    const daily = salary / 30;
    const deduct = Math.round((r.absent + r.unpaid) * daily);
    const net = Math.max(0, Math.round(salary - deduct - Number(r.advances)));
    return { ...r, salary, deduct, net };
  });
  const total = calc.reduce((s, r) => s + r.net, 0);
  return (
    <div>
      <div className="no-print">
        <PageHeader title="الرواتب" subtitle="الراتب − (أيام الغياب والإجازة بدون راتب × الراتب ÷ 30) − سُلف الشهر" />
        <StaffTabs active="/staff/payroll" />
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <form className="flex items-end gap-2">
            <label className="text-xs text-muted">الشهر<input type="month" name="month" defaultValue={month} className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></label>
            <button className="rounded-lg border border-line px-3 py-2 text-sm">عرض</button>
          </form>
          <PrintButton />
        </div>
      </div>
      <div id="report-sheet">
        <div className="mb-3 hidden text-center print:block"><div className="text-xl font-bold">{labName(identity)}</div><div>كشف رواتب شهر <span dir="ltr">{month}</span></div></div>
        <Card className="p-0 data-table">
          <table className="w-full text-sm" data-testid="payroll">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                {["الموظف", "الراتب", "الحضور", "التأخير", "الغياب", "بدون راتب", "الخصم", "السُّلف", "الصافي"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {calc.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0" data-testid="payroll-row">
                  <td className="px-3 py-2 font-medium">{r.full_name}</td>
                  <td className="px-3 py-2 tabular-nums">{money(r.salary)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.present}</td>
                  <td className="px-3 py-2 tabular-nums">{r.late}</td>
                  <td className="px-3 py-2 tabular-nums">{r.absent}</td>
                  <td className="px-3 py-2 tabular-nums">{r.unpaid}</td>
                  <td className="px-3 py-2 tabular-nums text-red-600">{r.deduct ? money(r.deduct) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-red-600">{Number(r.advances) ? money(r.advances) : "—"}</td>
                  <td className="px-3 py-2 font-bold tabular-nums" data-testid="payroll-net">{money(r.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-line font-bold"><td className="px-3 py-3" colSpan={8}>المجموع</td><td className="px-3 py-3 tabular-nums">{money(total)}</td></tr></tfoot>
          </table>
        </Card>
        <div className="mt-10 hidden justify-around text-sm print:flex"><span>المحاسب</span><span>مدير المختبر</span></div>
      </div>
    </div>
  );
}
