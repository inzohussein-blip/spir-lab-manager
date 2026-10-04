import { query, queryOne } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { StaffTabs } from "@/components/StaffTabs";
import { markAttendance, setWorkStart } from "@/app/actions/staff";
import { ensureOps } from "@/lib/desk/schema";

export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  present: ["حاضر", "bg-teal-50 text-brand-dark"], late: ["متأخر", "bg-amber-50 text-amber-800"],
  absent: ["غائب", "bg-red-50 text-red-700"], leave: ["إجازة", "bg-sky-50 text-sky-800"],
};
const btn = "rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas";

/** «الحضور والانصراف»: each person's day — check-in and out at the press of a button, or a status. */
export default async function AttendancePage(props: { searchParams: Promise<{ date?: string }> }) {
  await ensureOps();
  const today = (await queryOne<{ d: string }>(`select current_date::text as d`))!.d;
  const q = (await props.searchParams).date ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today;
  const [rows, start, month] = await Promise.all([
    query<any>(
      `select s.id, s.full_name, s.role, a.check_in::text as check_in, a.check_out::text as check_out, a.status,
              exists (select 1 from staff_leaves l where l.staff_id = s.id and $1::date between l.from_date and l.to_date) as on_leave
         from staff s left join attendance a on a.staff_id = s.id and a.work_date = $1
        where s.is_active order by s.full_name`,
      [date]
    ),
    queryOne<{ value: string }>(`select value from lab_settings where key = 'work_start'`).catch(() => null),
    query<any>(
      `select s.full_name, count(*) filter (where a.status in ('present','late'))::int as present,
              count(*) filter (where a.status = 'late')::int as late, count(*) filter (where a.status = 'absent')::int as absent
         from staff s left join attendance a on a.staff_id = s.id and to_char(a.work_date, 'YYYY-MM') = $1
        where s.is_active group by s.id, s.full_name order by s.full_name`,
      [date.slice(0, 7)]
    ),
  ]);
  const workStart = start?.value ?? "";
  const hm = (t: string | null) => (t ? t.slice(0, 5) : "—");

  return (
    <div>
      <PageHeader title="الحضور والانصراف" subtitle="سجّل حضور كل موظف وانصرافه بضغطة، أو حالته لليوم" />
      <StaffTabs active="/staff/attendance" />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2">
          <label className="text-xs text-muted">اليوم<input type="date" name="date" defaultValue={date} max={today} className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></label>
          <button className="rounded-lg border border-line px-3 py-2 text-sm">عرض</button>
        </form>
        <form action={setWorkStart} className="flex items-end gap-2">
          <label className="text-xs text-muted">بداية الدوام (بعدها = متأخر)<input type="time" name="work_start" defaultValue={workStart} aria-label="بداية الدوام" className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></label>
          <button className="rounded-lg border border-line px-3 py-2 text-sm">حفظ</button>
        </form>
      </div>
      <Card className="p-0 data-table">
        <table className="w-full text-sm" data-testid="attendance">
          <thead className="border-b border-line text-right text-muted">
            <tr><th className="px-4 py-3 font-medium">الموظف</th><th className="px-4 py-3 font-medium">الحضور</th><th className="px-4 py-3 font-medium">الانصراف</th><th className="px-4 py-3 font-medium">الحالة</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">أضف الكادر أولاً.</td></tr>}
            {rows.map((r) => {
              const st = r.status ?? (r.on_leave ? "leave" : null);
              const form = (op: string, label: string, cls = btn) => (
                <form action={markAttendance}>
                  <input type="hidden" name="staff_id" value={r.id} /><input type="hidden" name="date" value={date} />
                  <input type="hidden" name="op" value={op} /><input type="hidden" name="late_after" value={workStart} />
                  <button className={cls}>{label}</button>
                </form>
              );
              return (
                <tr key={r.id} className="border-b border-line last:border-0" data-testid="attendance-row">
                  <td className="px-4 py-3 font-medium">{r.full_name}<span className="block text-xs text-muted">{r.role ?? ""}</span></td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr">{hm(r.check_in)}</td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr">{hm(r.check_out)}</td>
                  <td className="px-4 py-3">{st ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[st][1]}`}>{STATUS[st][0]}</span> : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {!r.check_in && date === today && form("in", "حضور", "rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white")}
                      {r.check_in && !r.check_out && date === today && form("out", "انصراف", "rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white")}
                      {form("absent", "غائب")}
                      {form("leave", "إجازة")}
                      {r.status && form("clear", "مسح", `${btn} text-muted`)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card className="mt-4 p-0 data-table">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">الشهر <span dir="ltr">{date.slice(0, 7)}</span></div>
        <table className="w-full text-sm">
          <thead className="text-right text-xs text-muted"><tr><th className="px-4 py-2 font-medium">الموظف</th><th className="px-4 py-2 font-medium">أيام الحضور</th><th className="px-4 py-2 font-medium">التأخير</th><th className="px-4 py-2 font-medium">الغياب</th></tr></thead>
          <tbody>
            {month.map((m, i) => (
              <tr key={i} className="border-t border-line"><td className="px-4 py-2">{m.full_name}</td><td className="px-4 py-2 tabular-nums">{m.present}</td><td className="px-4 py-2 tabular-nums">{m.late}</td><td className="px-4 py-2 tabular-nums">{m.absent}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
