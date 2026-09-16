import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

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
        </Card>

        <Card>
          <div className="mb-3 font-semibold">سجل البدلاء (Cover Shifts)</div>
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
