"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, FlaskConical, Thermometer, Wrench, AlertTriangle, CheckCircle2, CalendarClock, type LucideIcon } from "lucide-react";
import { summary, getAnalytes, getResults, evaluateAnalyte, RULES, getDevices, taskDue, calibDue } from "@/lib/qc/store";
import { todayYmd, addDays } from "@/lib/local/util";

type Summary = ReturnType<typeof summary>;

function Tile({ href, icon: Icon, title, value, sub, tone }: { href: string; icon: LucideIcon; title: string; value: string; sub: string; tone: "ok" | "warn" | "bad" }) {
  const c = tone === "ok" ? "border-green-200 bg-green-50 text-green-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800";
  return (
    <Link href={href} className={`flex flex-col gap-1 rounded-2xl border p-4 transition-shadow hover:shadow-[var(--shadow-pop)] ${c}`}>
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" /> {title}</div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs opacity-80">{sub}</div>
    </Link>
  );
}

export default function QcDashboard() {
  const [s, setS] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<{ date: string; analyte: string; level: string; value: number; rules: string[] }[]>([]);
  const [due, setDue] = useState<{ device: string; what: string; days: number }[]>([]);

  useEffect(() => {
    setS(summary());
    const results = getResults();
    const since = addDays(todayYmd(), -7);
    const list: typeof alerts = [];
    for (const a of getAnalytes()) {
      const ev = evaluateAnalyte(a, results);
      for (const r of results) {
        if (r.analyteId !== a.id || r.date < since) continue;
        const e = ev.get(r.id);
        if (e && e.status !== "ok") list.push({ date: r.date, analyte: a.name, level: a.levels.find((l) => l.id === r.levelId)?.label ?? "", value: r.value, rules: e.rules });
      }
    }
    setAlerts(list.sort((x, y) => y.date.localeCompare(x.date)).slice(0, 12));
    const d: typeof due = [];
    for (const dev of getDevices()) {
      for (const t of dev.tasks) { const td = taskDue(t); if (td.days <= 0) d.push({ device: dev.name, what: t.name, days: td.days }); }
      const c = calibDue(dev); if (c && c.days <= 30) d.push({ device: dev.name, what: "المعايرة", days: c.days });
    }
    setDue(d.sort((x, y) => x.days - y.days).slice(0, 12));
  }, []);

  if (!s) return null;

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="size-6 text-brand" /> لوحة الجودة</h1>
      <p className="mb-5 text-sm text-muted">حالة اليوم (<span dir="ltr">{todayYmd()}</span>) — السيطرة النوعية، الحرارة، والأجهزة.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href="/qc/entry" icon={FlaskConical} title="السيطرة اليوم" value={`${s.levelsDone} / ${s.levelsTotal}`}
          sub={s.levelsDone === s.levelsTotal ? "كل المستويات أُدخلت" : "مستويات لم تُدخل بعد"} tone={s.levelsDone === s.levelsTotal ? "ok" : "warn"} />
        <Tile href="/qc/chart" icon={AlertTriangle} title="تنبيهات Westgard (7 أيام)" value={`${s.rejects} رفض`}
          sub={`${s.warns} تحذير 1-2s`} tone={s.rejects ? "bad" : s.warns ? "warn" : "ok"} />
        <Tile href="/qc/temps" icon={Thermometer} title="الحرارة اليوم" value={s.tempsOut ? `${s.tempsOut} خارج المدى` : `${s.tempsMissing} قراءة ناقصة`}
          sub={s.tempsOut ? "تحتاج إجراءً تصحيحياً" : s.tempsMissing ? "صباحاً ومساءً لكل جهاز" : "كل القراءات ضمن المدى"} tone={s.tempsOut ? "bad" : s.tempsMissing ? "warn" : "ok"} />
        <Tile href="/qc/devices" icon={Wrench} title="الأجهزة" value={`${s.tasksDue} مهمة مستحقة`}
          sub={`${s.calibOverdue} معايرة متأخرة · ${s.calibSoon} قريبة · ${s.openFaults} عطل مفتوح`} tone={s.calibOverdue || s.openFaults ? "bad" : s.tasksDue ? "warn" : "ok"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><AlertTriangle className="size-4 text-brand" /> آخر تنبيهات السيطرة</div>
          {alerts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="size-4" /> لا تنبيهات خلال آخر 7 أيام.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.map((a, i) => {
                const reject = a.rules.some((r) => RULES[r as keyof typeof RULES].reject);
                return (
                  <div key={i} className={`rounded-xl border px-3 py-2 text-sm ${reject ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-center justify-between gap-2"><b>{a.analyte}</b><span className="text-xs text-muted" dir="ltr">{a.date}</span></div>
                    <div className="text-xs">{a.level} — القيمة <b dir="ltr">{a.value}</b> — <span dir="ltr" className={`font-bold ${reject ? "text-red-700" : "text-amber-700"}`}>{a.rules.join(", ")}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4 text-brand" /> صيانة ومعايرة مستحقة</div>
          {due.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="size-4" /> لا شيء مستحق.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {due.map((d, i) => (
                <Link key={i} href="/qc/devices" className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:border-brand">
                  <span><b>{d.device}</b> — {d.what}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.days < 0 ? "bg-red-50 text-red-700" : d.days === 0 ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
                    {d.days < 0 ? `متأخر ${-d.days} يوم` : d.days === 0 ? "اليوم" : `بعد ${d.days} يوم`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
