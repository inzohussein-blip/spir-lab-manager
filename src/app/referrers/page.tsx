import { query } from "@/lib/db";
import { addReferrer } from "@/app/actions/crm";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default async function ReferrersPage() {
  const rows = await query<any>(
    `select r.id, r.name, r.clinic, r.phone, count(o.id)::int as orders
       from referrers r
       left join test_orders o on o.referrer_id = r.id
      group by r.id order by r.name`
  );

  return (
    <div className="max-w-2xl">
      <PageHeader title="الأطباء المُحيلون" subtitle="الأطباء والعيادات التي تُحيل المرضى" />

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">إضافة طبيب/عيادة</div>
        <form action={addReferrer} className="grid gap-2 sm:grid-cols-3">
          <input name="name" placeholder="اسم الطبيب" required className={field} />
          <input name="clinic" placeholder="العيادة/المستشفى" className={field} />
          <input name="phone" placeholder="الهاتف" className={field} />
          <div className="sm:col-span-3"><Button>إضافة</Button></div>
        </form>
      </Card>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الطبيب</th>
              <th className="px-4 py-3 font-medium">العيادة</th>
              <th className="px-4 py-3 font-medium">الهاتف</th>
              <th className="px-4 py-3 font-medium">الإحالات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">لا أطباء بعد</td></tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.clinic ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{r.phone ?? "—"}</td>
                <td className="px-4 py-3">{r.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
