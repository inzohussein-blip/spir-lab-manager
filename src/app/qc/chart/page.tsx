"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Printer } from "lucide-react";
import { getAnalytes, getResults, evaluateAnalyte, getSettings, RULES, type Analyte, type QcResult, type Evaluation, type QcSettings } from "@/lib/qc/store";
import { todayYmd, monthLabel } from "@/lib/local/util";
import { PrintStyle, Letterhead, PrintFooter, SignRow, exact } from "@/components/local/PrintDoc";
import { LJChart, qcStats as stats } from "@/components/qc/LJChart";

export default function ChartPage() {
  const [analytes, setAnalytes] = useState<Analyte[]>([]);
  const [results, setResults] = useState<QcResult[]>([]);
  const [settings, setSettings] = useState<QcSettings | null>(null);
  const [aid, setAid] = useState("");
  const [month, setMonth] = useState(todayYmd().slice(0, 7));

  useEffect(() => {
    const a = getAnalytes(); setAnalytes(a); setAid(a[0]?.id ?? ""); setResults(getResults()); setSettings(getSettings());
  }, []);

  const a = analytes.find((x) => x.id === aid);
  const ev = useMemo(() => (a ? evaluateAnalyte(a, results) : new Map<string, Evaluation>()), [a, results]);
  const perLevel = useMemo(() => (a ? a.levels.map((l) => ({
    level: l,
    points: results.filter((r) => r.analyteId === a.id && r.levelId === l.id && r.date.startsWith(month))
      .sort((x, y) => x.date.localeCompare(y.date) || x.at - y.at).map((r) => ({ r, e: ev.get(r.id) })),
  })) : []), [a, results, month, ev]);

  const body = a && (
    <div className="flex flex-col gap-4">
      {perLevel.map(({ level, points }) => {
        const st = stats(points.map((p) => p.r.value), level);
        const flagged = points.filter((p) => p.e && p.e.status !== "ok");
        return (
          <div key={level.id} className="keep rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] print:rounded-none print:border-gray-300 print:shadow-none">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-bold">{level.label}{level.lot && <span className="text-xs font-normal text-muted" dir="ltr"> · Lot {level.lot}</span>}</div>
              <div className="text-xs text-muted" dir="ltr">Target {level.mean} ± {level.sd} {a.unit}</div>
            </div>
            <LJChart level={level} points={points} />
            {st && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {[["عدد القيم", String(st.n)], ["المتوسط الفعلي", st.mean.toFixed(2)], ["SD الفعلي", st.sd.toFixed(2)], ["CV%", st.cv.toFixed(1) + "%"], ["الانحياز Bias", (st.bias > 0 ? "+" : "") + st.bias.toFixed(1) + "%"]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-canvas px-2.5 py-1.5 print:border print:border-gray-200"><div className="text-muted">{k}</div><b dir="ltr">{v}</b></div>
                ))}
              </div>
            )}
            {flagged.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                {flagged.map((p) => (
                  <div key={p.r.id} className={`rounded-lg px-2.5 py-1 ${p.e!.status === "reject" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`} style={exact}>
                    <b dir="ltr">{p.r.date}</b> — القيمة <b dir="ltr">{p.r.value}</b> (z={p.e!.z.toFixed(1)}) — {p.e!.rules.map((c) => `${c}: ${RULES[c].text}`).join(" | ")}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><LineChart className="size-6 text-brand" /> مخطط Levey-Jennings</h1>
            <p className="mt-1 text-sm text-muted">الخط الأخضر = المتوسط، البرتقالي = ±2SD، الأحمر = ±3SD. النقطة الحمراء = رفض، البرتقالية = تحذير.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select value={aid} onChange={(e) => setAid(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              {analytes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
            <button onClick={() => window.print()} disabled={!a} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer className="size-4" /> طباعة التقرير الشهري</button>
          </div>
        </div>
        {body}
      </div>

      {a && settings && (
        <div className="print-doc hidden bg-white text-[12px] text-black print:block">
          <PrintStyle />
          <Letterhead title={settings.title} subtitle={settings.subtitle} logo={settings.logo} color="#be123c"
            right={<><div className="font-bold" style={{ color: "#be123c" }}>تقرير السيطرة النوعية الشهري</div><div>{monthLabel(month)}</div></>} />
          <div className="my-3 text-sm"><b>{a.name}</b>{a.device && <> — {a.device}</>}{a.unit && <span dir="ltr"> ({a.unit})</span>}</div>
          {body}
          <SignRow labels={["أعدّه", "مسؤول الجودة", "مدير المختبر"]} />
          <PrintFooter text={settings.footer} color="#be123c" />
        </div>
      )}
    </div>
  );
}
