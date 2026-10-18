import { query, queryOne } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { StaffTabs } from "@/components/StaffTabs";
import { ScheduleBoard, type ShiftType } from "@/components/staff/ScheduleBoard";
import { saveShiftType, deleteShiftType } from "@/app/actions/staff";
import { ensureSchedule } from "@/lib/desk/schema";
import { getLabIdentity, labName } from "@/lib/lab-identity";

export const dynamic = "force-dynamic";

const field = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand";
const hm = (t: string | null) => (t ? String(t).slice(0, 5) : "");

/** «جدول المناوبات الأسبوعي»: the lab's shifts (name and hours) and who works which shift on each day. */
export default async function SchedulePage() {
  await ensureSchedule();
  const [staff, types, rows, dow, identity] = await Promise.all([
    query<{ id: string; full_name: string; role: string | null }>(`select id, full_name, role from staff where is_active order by full_name`),
    query<{ id: string; name: string; s: string | null; e: string | null }>(`select id, name, start_time::text as s, end_time::text as e from shift_types order by sort, name`),
    query<{ staff_id: string; weekday: number; shift_id: string | null; is_off: boolean }>(`select staff_id, weekday, shift_id, is_off from staff_schedule`),
    queryOne<{ d: number }>(`select extract(dow from current_date)::int as d`),
    getLabIdentity(),
  ]);
  const shifts: ShiftType[] = types.map((t) => ({ id: t.id, name: t.name, start: hm(t.s), end: hm(t.e) }));
  const cells = Object.fromEntries(rows.map((r) => [`${r.staff_id}:${r.weekday}`, r.is_off ? "off" : r.shift_id ?? ""]));

  return (
    <div>
      <div className="no-print">
        <PageHeader title="جدول المناوبات" subtitle="مناوبة كل موظف في كل يوم من الأسبوع، تتكرر كل أسبوع" />
        <StaffTabs active="/staff/schedule" />
      </div>
      <ScheduleBoard staff={staff.map((s) => ({ id: s.id, name: s.full_name, role: s.role ?? "" }))} shifts={shifts} cells={cells}
        today={dow?.d ?? new Date().getDay()} labName={labName(identity)} />

      <Card className="no-print mt-4">
        <div className="mb-2 font-semibold">المناوبات وأوقاتها</div>
        <div className="flex flex-col gap-2" data-testid="shift-types">
          {shifts.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2" data-shift={t.name}>
              <form action={saveShiftType} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input name="name" defaultValue={t.name} required aria-label="اسم المناوبة" className={`${field} w-32`} />
                <input type="time" name="start" defaultValue={t.start} aria-label={`بداية ${t.name}`} className={field} />
                <span className="text-muted">–</span>
                <input type="time" name="end" defaultValue={t.end} aria-label={`نهاية ${t.name}`} className={field} />
                <button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">حفظ</button>
              </form>
              <form action={deleteShiftType}>
                <input type="hidden" name="id" value={t.id} />
                <button className="rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50" aria-label={`حذف ${t.name}`}>حذف</button>
              </form>
            </div>
          ))}
          <form action={saveShiftType} className="mt-1 flex flex-wrap items-center gap-2 border-t border-line pt-3" data-testid="shift-new">
            <input name="name" required placeholder="مناوبة جديدة (مثلاً: دوام جزئي)" aria-label="اسم المناوبة الجديدة" className={`${field} w-56`} />
            <input type="time" name="start" aria-label="بداية المناوبة الجديدة" className={field} />
            <span className="text-muted">–</span>
            <input type="time" name="end" aria-label="نهاية المناوبة الجديدة" className={field} />
            <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">إضافة</button>
          </form>
        </div>
      </Card>
    </div>
  );
}
