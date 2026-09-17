import { CalendarClock, CalendarCheck, CalendarX } from "lucide-react";
import { query } from "@/lib/db";
import { createAppointment, setAppointmentStatus } from "@/app/actions/crm";
import { PageHeader, Card, Button, StatTile } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const statusLabel: Record<string, string> = { scheduled: "مجدول", done: "تم", cancelled: "ملغى" };
const statusTone: Record<string, string> = {
  scheduled: "bg-amber-50 text-amber-700",
  done: "bg-teal-50 text-brand-dark",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function AppointmentsPage() {
  const [patients, referrers, appts] = await Promise.all([
    query<any>(`select id, full_name from patients order by created_at desc limit 100`),
    query<any>(`select id, name from referrers order by name`),
    query<any>(
      `select a.id, a.scheduled_at, a.purpose, a.status,
              coalesce(p.full_name, a.patient_name) as who, r.name as referrer
         from appointments a
         left join patients p on p.id = a.patient_id
         left join referrers r on r.id = a.referrer_id
        order by a.scheduled_at desc limit 200`
    ),
  ]);

  const scheduled = appts.filter((a: any) => a.status === "scheduled").length;
  const done = appts.filter((a: any) => a.status === "done").length;
  const cancelled = appts.filter((a: any) => a.status === "cancelled").length;

  return (
    <div>
      <PageHeader title="المواعيد" subtitle="حجز ومتابعة مواعيد المرضى" />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="مجدولة" value={scheduled} tone={scheduled ? "warn" : "brand"} icon={<CalendarClock className="size-5" />} />
        <StatTile label="تمّت" value={done} icon={<CalendarCheck className="size-5" />} />
        <StatTile label="ملغاة" value={cancelled} tone="neutral" icon={<CalendarX className="size-5" />} />
      </div>

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">موعد جديد</div>
        <form action={createAppointment} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select name="patient_id" className={field} defaultValue="">
            <option value="">مريض مسجّل…</option>
            {patients.map((p: any) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <input name="patient_name" placeholder="أو اسم مباشر" className={field} />
          <select name="referrer_id" className={field} defaultValue="">
            <option value="">الطبيب المُحيل…</option>
            {referrers.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <input name="scheduled_at" type="datetime-local" required className={field} />
          <input name="purpose" placeholder="الغرض (فحص/سحب عينة…)" className={`${field} lg:col-span-3`} />
          <Button>حجز</Button>
        </form>
      </Card>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الموعد</th>
              <th className="px-4 py-3 font-medium">المريض</th>
              <th className="px-4 py-3 font-medium">المُحيل</th>
              <th className="px-4 py-3 font-medium">الغرض</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {appts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">لا مواعيد بعد</td></tr>
            )}
            {appts.map((a: any) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{String(a.scheduled_at).slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3 font-medium">{a.who ?? "—"}</td>
                <td className="px-4 py-3">{a.referrer ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{a.purpose ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[a.status]}`}>{statusLabel[a.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {a.status === "scheduled" && (
                    <div className="flex gap-1">
                      <form action={setAppointmentStatus}>
                        <input type="hidden" name="appointment_id" value={a.id} />
                        <input type="hidden" name="status" value="done" />
                        <button className="rounded-lg bg-brand-light px-2 py-1 text-xs font-semibold text-brand-dark">تم</button>
                      </form>
                      <form action={setAppointmentStatus}>
                        <input type="hidden" name="appointment_id" value={a.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <button className="rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">إلغاء</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
