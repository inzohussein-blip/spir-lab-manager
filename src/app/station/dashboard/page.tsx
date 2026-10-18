"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, ClipboardPlus, FileText, KanbanSquare, Clock, PackageX } from "lucide-react";
import { dashboardData, ago, type Dashboard } from "@/lib/station/insights";
import { getSettings } from "@/lib/station/store";
import { PillBars, Gauge, Sparkline, Avatar, BarList } from "@/components/charts/NewCharts";

const card = "rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)]";

/** One of the four figures at the top: the first in the deep colour, each opening its page. */
function Kpi({ label, value, note, href, dark, testId }: { label: string; value: string; note: string; href: string; dark?: boolean; testId: string }) {
  return (
    <Link href={href} data-testid={testId} className={`relative block rounded-3xl p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-pop)] ${dark ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "bg-surface"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className={`grid size-9 place-items-center rounded-full border ${dark ? "border-white/60 bg-white text-brand-dark" : "border-ink/20"}`}><ArrowUpRight className="size-4" /></span>
      </div>
      <div className="mt-3 text-4xl font-extrabold tabular-nums">{value}</div>
      <div className={`mt-2 text-[11px] ${dark ? "text-white/80" : "text-muted"}`}>{note}</div>
    </Link>
  );
}

/**
 * «لوحة التحكم» (the new look, as in spir-supply-manager): the lab's day at a glance — today's visits,
 * results still to write, ready to hand over, the month — the week's visits, the next results to
 * write, the most requested tests, and the stock room's state (counted only: the stations do not
 * link to one another). From this device's data.
 */
export default function StationDashboard() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [delivery, setDelivery] = useState(false);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const load = () => { setD(dashboardData()); setDelivery(getSettings().deliveryStatus === true); };
    load();
    const t = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" }));
    t();
    const i = setInterval(() => { t(); load(); }, 30_000);
    return () => clearInterval(i);
  }, []);
  if (!d) return null;
  return (
    <div data-testid="dashboard-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted">يوم المختبر في مكان واحد هادئ — من بيانات هذا الجهاز.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/station" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-brand to-brand-dark px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_var(--color-brand)]"><Plus className="size-4" /> مراجع جديد</Link>
          <Link href="/station/analytics" className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-5 py-2.5 text-sm font-semibold">التحليلات</Link>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi dark testId="dash-kpi-today" label="زيارات اليوم" value={String(d.today)} note={`${d.todayTests} فحص`} href="/station/visits" />
        <Kpi testId="dash-kpi-pending" label="بانتظار النتائج" value={String(d.pending)} note={d.pending ? "زيارات فيها فحص بلا نتيجة" : "كل النتائج مكتوبة"} href="/station/tasks" />
        {delivery
          ? <Kpi testId="dash-kpi-ready" label="جاهزة للتسليم" value={String(d.ready)} note={`سُلّم اليوم ${d.deliveredToday}`} href="/station/tasks" />
          : <Kpi testId="dash-kpi-ready" label="مكتملة هذا الشهر" value={`${d.doneShare}%`} note="من زيارات الشهر بنتائج كاملة" href="/station/visits" />}
        <Kpi testId="dash-kpi-month" label="زيارات الشهر" value={String(d.month)} note={d.monthChange == null ? "لا شهر سابق للمقارنة" : `${d.monthChange > 0 ? "+" : ""}${d.monthChange}% عن الفترة نفسها من الشهر الماضي`} href="/station/analytics" />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr_1fr]">
        <section className={card} data-testid="dash-week">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">زيارات الأسبوع</h2><span className="text-xs tabular-nums text-muted">{d.weekTotal} زيارة</span></div>
          <PillBars items={d.week.map((w) => ({ label: w.label, value: w.value, tone: w.tone, note: w.note, tip: w.tip }))} />
        </section>
        <section className={card} data-testid="dash-waiting">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">التالي</h2><Link href="/station/tasks" className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1 text-xs"><KanbanSquare className="size-3.5" /> المهام</Link></div>
          <ul className="flex flex-col gap-2.5">
            {d.waiting.length === 0 && <li className="py-6 text-center text-sm text-muted">لا نتائج بانتظار الكتابة</li>}
            {d.waiting.map((w) => (
              <li key={w.id}><Link href={`/station?edit=${w.id}`} className="flex items-center gap-3 rounded-2xl px-1 py-0.5 hover:bg-canvas">
                <Avatar name={w.name} className="size-8" />
                <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-semibold">{w.name}</span><span className="block truncate text-[11px] text-muted">{w.missing} من {w.total} بلا نتيجة · {ago(w.at)}</span></span>
              </Link></li>
            ))}
          </ul>
        </section>
        <section className={card} data-testid="dash-top">
          <h2 className="mb-3 text-lg font-bold">الأكثر طلباً هذا الشهر</h2>
          <BarList rows={d.topTests} />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr]">
        <section className={card} data-testid="dash-done">
          <h2 className="mb-2 text-lg font-bold">اكتمال الشهر</h2>
          <Gauge percent={d.doneShare} label="من الزيارات نتائجها كاملة" />
        </section>
        <section className={card} data-testid="dash-stock">
          <h2 className="mb-3 text-lg font-bold">المخزن</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-3 ${d.low ? "bg-amber-50 text-amber-900" : "bg-canvas"}`}><PackageX className="mb-1 size-5" /><div className="text-2xl font-extrabold tabular-nums">{d.low}</div><div className="text-[11px]">تحت الحد الأدنى</div></div>
            <div className={`rounded-2xl p-3 ${d.expiring ? "bg-rose-50 text-rose-900" : "bg-canvas"}`}><Clock className="mb-1 size-5" /><div className="text-2xl font-extrabold tabular-nums">{d.expiring}</div><div className="text-[11px]">ينتهي خلال 30 يوماً</div></div>
          </div>
          <p className="mt-3 text-[11px] text-muted">التفاصيل في محطة «المخزن والمشتريات» من الصفحة الرئيسية.</p>
        </section>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark to-[color-mix(in_oklab,var(--color-brand-dark)_65%,black)] p-5 text-white shadow-[var(--shadow-card)]" data-testid="dash-today">
          <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.1]" aria-hidden><defs><pattern id="dw" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M0 13 Q6.5 0 13 13 T26 13" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#dw)" /></svg>
          <div className="relative flex items-center justify-between text-sm font-semibold"><span>اليوم</span><span className="tabular-nums text-white/80" dir="ltr">{clock}</span></div>
          <div className="relative mt-2 text-4xl font-extrabold tabular-nums">{d.today}</div>
          <div className="relative text-[11px] text-white/75">زيارة · {d.todayTests} فحص (7 صباحاً — 10 مساءً)</div>
          <div className="relative mt-3 text-white"><Sparkline values={d.todayHours} className="[&_*]:!text-white" /></div>
          <div className="relative mt-3 flex gap-2">
            <Link href="/station" className="grid size-10 place-items-center rounded-full bg-white text-brand-dark" aria-label="مراجع جديد"><ClipboardPlus className="size-4" /></Link>
            <Link href="/station/visits" className="grid size-10 place-items-center rounded-full bg-white/15" aria-label="الزيارات المحفوظة"><FileText className="size-4" /></Link>
            <Link href="/station/tasks" className="grid size-10 place-items-center rounded-full bg-white/15" aria-label="لوحة المهام"><KanbanSquare className="size-4" /></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
