"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { analyticsData, type Analytics } from "@/lib/station/insights";
import { AreaChart, Sparkline, Heatmap, BarList, Avatar, HEAT_STEPS } from "@/components/charts/NewCharts";
import { xlsx } from "@/lib/xlsx";

const card = "rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)]";
const RANGES = [7, 30, 90] as const;

function download(name: string, data: Uint8Array) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * «التحليلات» (the new look, as in spir-supply-manager): the period's figures against the one before,
 * the daily visits (7-day average) with the previous period dashed, the tests by section, the most
 * requested tests and referring doctors, and the activity of the last 20 weeks — with Excel.
 */
export default function StationAnalytics() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => { setA(analyticsData(days)); }, [days]);
  if (!a) return null;
  const exportXlsx = () => download(`analytics-${a.from}-${a.to}.xlsx`, xlsx([
    { name: "الملخص", rows: [["من", a.from], ["إلى", a.to], [], ["المؤشر", "القيمة", "التغيّر %"], ...a.kpis.map((k) => [k.label, k.value, k.change ?? ""])] },
    { name: "الزيارات يومياً", rows: [["اليوم", "الزيارات", "الفترة السابقة"], ...a.trend.dates.map((d, i) => [d, a.trend.rawNow[i], a.trend.rawBefore[i]])] },
    { name: "حسب القسم", rows: [["القسم", "الفحوصات"], ...a.categories.map((c) => [c.name, c.n])] },
    { name: "الأكثر طلباً", rows: [["الفحص", "العدد"], ...a.topTests.map((c) => [c.name, c.n])] },
    { name: "الأطباء", rows: [["الطبيب المُحيل", "الزيارات"], ...a.referrers.map((c) => [c.name, c.n])] },
  ]));
  return (
    <div data-testid="analytics-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">التحليلات</h1>
          <p className="mt-1 text-sm text-muted">كيف يسير العمل وما الذي يُطلب — مقارنة بالفترة السابقة.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-surface p-1 shadow-[var(--shadow-card)]" role="radiogroup" aria-label="الفترة" data-testid="analytics-range">
            {RANGES.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={days === r} onClick={() => setDays(r)} data-testid={`range-${r}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${days === r ? "bg-gradient-to-b from-brand to-brand-dark text-white" : "text-muted hover:text-ink"}`}>{r} يوم</button>
            ))}
          </div>
          <button type="button" onClick={exportXlsx} data-testid="analytics-excel" className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-surface px-4 py-2 text-sm font-semibold"><Download className="size-4" /> تصدير Excel</button>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {a.kpis.map((k) => {
          const up = (k.change ?? 0) >= 0;
          return (
            <div key={k.key} className={card} data-testid={`analytics-kpi-${k.key}`}>
              <div className="text-sm text-muted">{k.label}</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums">{k.value.toLocaleString("en-US")}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                {k.change != null && <span className={`inline-flex items-center font-semibold ${up ? "text-emerald-700" : "text-red-600"}`}>{up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(k.change)}%</span>}
                <span>{k.change == null ? "لا فترة سابقة للمقارنة" : `عن الـ${days} يوماً السابقة`}</span>
              </div>
              <div className="mt-2"><Sparkline values={k.spark} /></div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className={card} data-testid="analytics-trend">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">الزيارات اليومية</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-brand-dark" /> هذه الفترة</span><span className="flex items-center gap-1"><span className="w-4 border-t border-dashed border-[#8a9a92]" /> السابقة</span></div>
          </div>
          <p className="mb-3 text-xs text-muted">عدد الزيارات كل يوم (متوسط 7 أيام) مقابل الفترة السابقة — مرّر المؤشر على يوم لترى رقمه.</p>
          <AreaChart now={a.trend.now} before={a.trend.before} labels={a.trend.labels}
            tip={(i) => `${a.trend.dates[i]}: ${a.trend.rawNow[i]} زيارة (المتوسط ${a.trend.now[i]}) — قبل ${days} يوماً: ${a.trend.rawBefore[i]}`} />
        </section>
        <section className={card} data-testid="analytics-categories">
          <h2 className="mb-3 text-lg font-bold">الفحوصات حسب القسم</h2>
          <BarList rows={a.categories} testid="analytics-category-list" />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className={card} data-testid="analytics-activity">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-bold">النشاط</h2>
            <span className="flex items-center gap-1 text-[10px] text-muted">أقل {HEAT_STEPS.map((c) => <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />)} أكثر</span>
          </div>
          <p className="mb-3 text-xs text-muted">عدد الزيارات كل يوم — آخر 20 أسبوعاً</p>
          <Heatmap days={a.heat} label={(d) => `${d.date}: ${d.value} زيارة`} />
        </section>
        <section className={card} data-testid="analytics-top">
          <h2 className="mb-3 text-lg font-bold">الأعلى</h2>
          <div className="mb-1.5 text-[11px] font-semibold text-muted">الفحوصات</div>
          <BarList rows={a.topTests.slice(0, 5)} testid="analytics-top-tests" />
          <div className="mb-1.5 mt-4 text-[11px] font-semibold text-muted">الأطباء المُحيلون</div>
          {a.referrers.length === 0 && <p className="text-xs text-muted">لا أطباء في هذه الفترة</p>}
          {a.referrers.map((r) => (
            <div key={r.name} className="mb-2 flex items-center gap-2.5" title={`${r.name}: ${r.n} زيارة`}>
              <Avatar name={r.name} className="size-8" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
              <span className="tabular-nums text-sm text-muted">{r.n}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
