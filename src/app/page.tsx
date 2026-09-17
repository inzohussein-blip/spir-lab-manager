import Link from "next/link";
import {
  AlertTriangle, CalendarClock, Users, Coins, Boxes, CalendarX,
  FlaskConical, PackageCheck, Wallet, UserPlus, ClipboardList, Send,
} from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { PageHeader, StatTile, Card, Button } from "@/components/ui/primitives";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/patients/new", label: "تسجيل مريض", icon: UserPlus },
  { href: "/orders/new", label: "طلب فحص", icon: ClipboardList },
  { href: "/worklist", label: "طاولة المختبر", icon: FlaskConical },
  { href: "/release", label: "تسليم النتائج", icon: Send },
];

export default async function DashboardPage() {
  const [today, queues, lowStock, expiring, recent] = await Promise.all([
    queryOne<{ visits: number; income: number }>(
      `select count(*)::int as visits, coalesce(sum(total_amount),0) as income
         from test_orders where order_date = current_date`
    ),
    queryOne<{ in_lab: number; to_deliver: number; uncollected: number }>(
      `select
         count(*) filter (where status in ('pending','in_progress'))::int as in_lab,
         count(*) filter (where status = 'completed')::int as to_deliver,
         coalesce(sum(total_amount) filter (where payment_status <> 'paid'),0) as uncollected
       from test_orders`
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
  const q = queues || { in_lab: 0, to_deliver: 0, uncollected: 0 };

  return (
    <div>
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة سريعة على نشاط المختبر اليوم"
      />

      {/* Quick actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Button key={a.href} href={a.href} variant="ghost">
            <a.icon className="size-4" /> {a.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="مراجعو اليوم" value={today?.visits ?? 0} icon={<Users className="size-5" />} />
        <StatTile
          label="دخل اليوم"
          value={`${money(today?.income)} ر.س`}
          hint="من الفحوصات المسجّلة اليوم"
          icon={<Coins className="size-5" />}
        />
        <StatTile
          label="مواد تحت الحد الأدنى"
          value={lowStock.length}
          tone={lowStock.length ? "danger" : "brand"}
          icon={<Boxes className="size-5" />}
        />
        <StatTile
          label="كواشف قاربت الانتهاء"
          value={expiring.length}
          tone={expiring.length ? "warn" : "brand"}
          icon={<CalendarX className="size-5" />}
        />
      </div>

      {/* Workflow queues */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Link href="/worklist" className="block">
          <StatTile
            label="قيد الفحص في المختبر"
            value={q.in_lab}
            hint="بانتظار إدخال النتائج"
            tone={q.in_lab ? "warn" : "brand"}
            icon={<FlaskConical className="size-5" />}
          />
        </Link>
        <Link href="/release" className="block">
          <StatTile
            label="جاهزة للتسليم"
            value={q.to_deliver}
            hint="نتائج مكتملة"
            tone={q.to_deliver ? "brand" : "neutral"}
            icon={<PackageCheck className="size-5" />}
          />
        </Link>
        <Link href="/orders?payment=unpaid" className="block">
          <StatTile
            label="دخل غير محصّل"
            value={`${money(q.uncollected)} ر.س`}
            hint="طلبات غير مدفوعة/جزئية"
            tone={Number(q.uncollected) > 0 ? "danger" : "brand"}
            icon={<Wallet className="size-5" />}
          />
        </Link>
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
