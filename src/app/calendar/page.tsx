import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const days = await query<{ order_date: string; visits: number; income: number }>(
    `select order_date, visits, income from v_daily_summary
      order by order_date desc limit 60`
  );

  return (
    <div>
      <PageHeader
        title="التقويم اليومي"
        subtitle="القسم 2 — عدد المراجعين والدخل لكل يوم"
      />
      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">اليوم</th>
              <th className="px-4 py-3 font-medium">عدد المراجعين</th>
              <th className="px-4 py-3 font-medium">الدخل</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted">
                  لا توجد بيانات بعد
                </td>
              </tr>
            )}
            {days.map((d) => (
              <tr key={d.order_date} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{d.order_date}</td>
                <td className="px-4 py-3">{d.visits}</td>
                <td className="px-4 py-3">{money(d.income)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
