import { query } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { addStaff, addCoverShift } from "@/app/actions/staff";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default async function StaffPage() {
  const [staff, covers] = await Promise.all([
    query<any>(
      `select id, full_name, role, phone from staff where is_active order by full_name`
    ),
    query<any>(
      `select c.cover_date, c.reason,
              a.full_name as original_name, b.full_name as cover_name
         from cover_shifts c
         left join staff a on a.id = c.original_staff_id
         left join staff b on b.id = c.cover_staff_id
        order by c.cover_date desc limit 30`
    ),
  ]);

  return (
    <div>
      <PageHeader title="الكادر والبدلاء" subtitle="القسم 6 — سجل العاملين والبدلاء" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">سجل الكادر</div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                <th className="py-2 font-medium">الاسم</th>
                <th className="py-2 font-medium">الدور</th>
                <th className="py-2 font-medium">الهاتف</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="py-2 font-medium">{s.full_name}</td>
                  <td className="py-2">{s.role ?? "—"}</td>
                  <td className="py-2 text-muted">{s.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <form action={addStaff} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
            <input name="full_name" placeholder="الاسم" required className={field} />
            <input name="role" placeholder="الدور" className={field} />
            <input name="phone" placeholder="الهاتف" className={field} />
            <div className="sm:col-span-3">
              <Button>إضافة موظف</Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="mb-3 font-semibold">سجل البدلاء (Cover Shifts)</div>

          <form action={addCoverShift} className="mb-4 grid gap-2 border-b border-line pb-4 sm:grid-cols-2">
            <input name="cover_date" type="date" required className={field} />
            <input name="reason" placeholder="السبب" className={field} />
            <select name="original_staff_id" className={field} defaultValue="">
              <option value="">الموظف الأصلي…</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
            <select name="cover_staff_id" className={field} defaultValue="">
              <option value="">البديل…</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <Button>تسجيل بديل</Button>
            </div>
          </form>

          {covers.length === 0 ? (
            <p className="text-sm text-muted">لا توجد بدلاء مسجّلة</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line text-right text-muted">
                <tr>
                  <th className="py-2 font-medium">التاريخ</th>
                  <th className="py-2 font-medium">الأصلي</th>
                  <th className="py-2 font-medium">البديل</th>
                  <th className="py-2 font-medium">السبب</th>
                </tr>
              </thead>
              <tbody>
                {covers.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="py-2">{c.cover_date}</td>
                    <td className="py-2">{c.original_name ?? "—"}</td>
                    <td className="py-2">{c.cover_name ?? "—"}</td>
                    <td className="py-2 text-muted">{c.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
