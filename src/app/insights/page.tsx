import { Wallet } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Card, StatTile } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_LABEL = (d: string) => d.slice(5); // MM-DD

export default async function InsightsPage() {
  const [
    kpis,
    dailyRevenue,
    topTests,
    byCategory,
    flags,
    byReferrer,
  ] = await Promise.all([
    query<any>(
      `select
         coalesce(sum(total_amount) filter (where order_date = current_date),0) as rev_day,
         coalesce(sum(total_amount) filter (where order_date >= current_date - interval '7 days'),0) as rev_week,
         coalesce(sum(total_amount) filter (where order_date >= date_trunc('month', current_date)),0) as rev_month,
         count(*) filter (where order_date >= current_date - interval '30 days')::int as orders_month,
         coalesce(sum(total_amount) filter (where payment_status <> 'paid'),0) as uncollected,
         count(*) filter (where payment_status <> 'paid')::int as unpaid_orders
       from test_orders`
    ),
    query<{ order_date: string; income: number; visits: number }>(
      `select to_char(d::date,'YYYY-MM-DD') as order_date,
              coalesce(sum(o.total_amount),0) as income,
              count(o.id)::int as visits
         from generate_series(current_date - interval '13 days', current_date, interval '1 day') d
         left join test_orders o on o.order_date = d::date
        group by d order by d`
    ),
    query<{ name_ar: string; c: number }>(
      `select t.name_ar, count(*)::int as c
         from test_order_items i join test_catalog t on t.id = i.test_id
        group by t.name_ar order by c desc limit 8`
    ),
    query<{ category: string; c: number }>(
      `select coalesce(t.category,'غير مصنّف') as category, count(*)::int as c
         from test_order_items i join test_catalog t on t.id = i.test_id
        group by t.category order by c desc limit 8`
    ),
    query<{ flag: string; c: number }>(
      `select coalesce(flag,'—') as flag, count(*)::int as c
         from test_results group by flag`
    ),
    query<{ name: string; visits: number; revenue: number }>(
      `select coalesce(r.name, 'مرضى خارجيون') as name,
              count(distinct o.id)::int as visits,
              coalesce(sum(o.total_amount), 0) as revenue
         from test_orders o
         left join referrers r on r.id = o.referrer_id
        group by coalesce(r.name, 'مرضى خارجيون')
        order by visits desc limit 8`
    ),
  ]);

  const k = kpis[0] || {};
  const flagMap: Record<string, number> = {};
  for (const f of flags) flagMap[f.flag] = f.c;
  const totalResults = flags.reduce((s, f) => s + Number(f.c), 0);
  const abnormal = (flagMap["H"] || 0) + (flagMap["L"] || 0);
  const abnormalPct = totalResults ? Math.round((abnormal / totalResults) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="لوحة التحليلات"
        subtitle="القسم 8 — رؤية بيانية لأداء المختبر (رسوم SVG خفيفة)"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile label="دخل اليوم" value={`${money(k.rev_day)} د.ع`} />
        <StatTile label="دخل الأسبوع" value={`${money(k.rev_week)} د.ع`} tone="neutral" />
        <StatTile label="دخل الشهر" value={`${money(k.rev_month)} د.ع`} tone="neutral" />
        <StatTile
          label="الدخل غير المُحصَّل"
          value={`${money(k.uncollected)} د.ع`}
          hint={`${k.unpaid_orders || 0} طلب غير مدفوع`}
          tone={Number(k.uncollected) > 0 ? "danger" : "brand"}
          icon={<Wallet className="size-5" />}
        />
        <StatTile
          label="نسبة النتائج غير الطبيعية"
          value={`${abnormalPct}%`}
          hint={`${abnormal} من ${totalResults} نتيجة`}
          tone={abnormalPct > 40 ? "warn" : "brand"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">الدخل اليومي (آخر 14 يوماً)</div>
          <LineChart
            data={dailyRevenue.map((d) => ({ label: DAY_LABEL(d.order_date), value: Number(d.income) }))}
            formatValue={money}
            ariaLabel="الدخل اليومي لآخر 14 يوماً"
          />
        </Card>
        <Card>
          <div className="mb-3 font-semibold">عدد المراجعين (آخر 14 يوماً)</div>
          <BarChart
            data={dailyRevenue.map((d) => ({ label: DAY_LABEL(d.order_date), value: Number(d.visits) }))}
            ariaLabel="عدد المراجعين لآخر 14 يوماً"
          />
        </Card>
        <Card>
          <div className="mb-3 font-semibold">الفحوصات الأكثر طلباً</div>
          {topTests.length ? (
            <BarChart
              data={topTests.map((t) => ({ label: t.name_ar, value: Number(t.c) }))}
              ariaLabel="الفحوصات الأكثر طلباً"
            />
          ) : (
            <p className="text-sm text-muted">لا توجد بيانات بعد</p>
          )}
        </Card>
        <Card>
          <div className="mb-3 font-semibold">الفحوصات حسب التصنيف</div>
          {byCategory.length ? (
            <BarChart
              data={byCategory.map((t) => ({ label: t.category, value: Number(t.c) }))}
              ariaLabel="الفحوصات حسب التصنيف"
            />
          ) : (
            <p className="text-sm text-muted">لا توجد بيانات بعد</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 font-semibold">المراجعون حسب الطبيب المُحيل</div>
          {byReferrer.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <BarChart
                data={byReferrer.map((r) => ({ label: r.name, value: Number(r.visits) }))}
                ariaLabel="المراجعون حسب الطبيب المُحيل"
              />
              <table className="w-full self-start text-sm">
                <thead className="border-b border-line text-right text-muted">
                  <tr>
                    <th className="py-2 font-medium">المصدر</th>
                    <th className="py-2 font-medium">المراجعون</th>
                    <th className="py-2 font-medium">الدخل</th>
                  </tr>
                </thead>
                <tbody>
                  {byReferrer.map((r) => (
                    <tr key={r.name} className="border-b border-line last:border-0">
                      <td className="py-2 font-medium">{r.name}</td>
                      <td className="py-2">{r.visits}</td>
                      <td className="py-2 tabular-nums">{money(r.revenue)} د.ع</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">لا توجد بيانات بعد</p>
          )}
        </Card>
      </div>
    </div>
  );
}
