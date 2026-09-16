import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { PageHeader, StatTile, Card } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [today, lowStock, expiring, recent] = await Promise.all([
    queryOne<{ visits: number; income: number }>(
      `select count(*)::int as visits, coalesce(sum(total_amount),0) as income
         from test_orders where order_date = current_date`
    ),
    query<{ id: string; name: string; quantity: number; min_quantity: number }>(
      `select id, name, quantity, min_quantity from v_low_stock order by quantity asc limit 6`
    ),
    query<{ id: string; name: string; expiry_date: string }>(
      `select id, name, expiry_date from v_expiring_reagents order by expiry_date asc limit 6`
    ),
    query<{ id: string; full_name: string; created_at: string }>(
      `select id, full_name, created_at from patients order by created_at desc limit 6`
    ),
  ]);

  return (
    <div>
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة سريعة على نشاط المختبر اليوم"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="مراجعو اليوم" value={today?.visits ?? 0} />
        <StatTile
          label="دخل اليوم"
          value={money(today?.income)}
          hint="من الفحوصات المسجّلة اليوم"
        />
        <StatTile
          label="مواد تحت الحد الأدنى"
          value={lowStock.length}
          tone={lowStock.length ? "danger" : "brand"}
        />
        <StatTile
          label="كواشف قاربت الانتهاء"
          value={expiring.length}
          tone={expiring.length ? "warn" : "brand"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4.5 text-red-600" />
            تنبيهات المخزون
          </div>
          {lowStock.length === 0 && expiring.length === 0 ? (
            <p className="text-sm text-muted">لا توجد تنبيهات حالياً ✅</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {lowStock.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-red-600">
                    متبقٍ {p.quantity} (الحد {p.min_quantity})
                  </span>
                </li>
              ))}
              {expiring.map((p) => (
                <li key={p.id} className="flex justify-between text-amber-700">
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-4" />
                    {p.name}
                  </span>
                  <span>ينتهي {p.expiry_date}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 font-semibold">أحدث المرضى</div>
          <ul className="flex flex-col gap-2 text-sm">
            {recent.length === 0 && (
              <li className="text-muted">لا يوجد مرضى بعد</li>
            )}
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-canvas"
                >
                  <span>{p.full_name}</span>
                  <span className="text-muted">{p.created_at?.slice(0, 10)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
