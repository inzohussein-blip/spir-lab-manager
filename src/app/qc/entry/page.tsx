"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FlaskConical, CheckCircle2, AlertTriangle, XCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { getAnalytes, getResults, setResult, evaluateAnalyte, RULES, type Analyte, type QcResult } from "@/lib/qc/store";
import { todayYmd, addDays } from "@/lib/local/util";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function QcEntryPage() {
  const [date, setDate] = useState(todayYmd());
  const [analytes, setAnalytes] = useState<Analyte[]>([]);
  const [results, setResults] = useState<QcResult[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [by, setBy] = useState("");

  const reload = () => setResults(getResults());
  useEffect(() => { setAnalytes(getAnalytes().filter((a) => a.active)); reload(); }, []);
  useEffect(() => { setDrafts({}); }, [date]);

  const evals = useMemo(() => {
    const m = new Map<string, ReturnType<typeof evaluateAnalyte>>();
    analytes.forEach((a) => m.set(a.id, evaluateAnalyte(a, results)));
    return m;
  }, [analytes, results]);

  const key = (a: string, l: string) => `${a}|${l}`;
  function commit(a: Analyte, levelId: string) {
    const k = key(a.id, levelId);
    if (!(k in drafts)) return;
    const raw = drafts[k].trim();
    setResult(a.id, levelId, date, raw === "" ? null : Number(raw), by.trim() ? { by: by.trim() } : {});
    setDrafts((d) => { const n = { ...d }; delete n[k]; return n; });
    reload();
  }

  const doneCount = analytes.reduce((s, a) => s + a.levels.filter((l) => results.some((r) => r.analyteId === a.id && r.levelId === l.id && r.date === date)).length, 0);
  const total = analytes.reduce((s, a) => s + a.levels.length, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FlaskConical className="size-6 text-brand" /> إدخال السيطرة اليومية</h1>
          <p className="mt-1 text-sm text-muted">أدخل قيمة كل مستوى — تُقيَّم فوراً بقواعد Westgard وتُحفظ عند مغادرة الحقل.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">المنفّذ<input value={by} onChange={(e) => setBy(e.target.value)} className={`mt-1 ${inp} w-36`} /></label>
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(addDays(date, -1))} title="اليوم السابق" className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronRight className="size-4" /></button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inp} w-40`} />
            <button onClick={() => setDate(addDays(date, 1))} title="اليوم التالي" className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronLeft className="size-4" /></button>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums ${doneCount === total ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{doneCount}/{total}</span>
        </div>
      </div>

      {analytes.length === 0 && <p className="text-sm text-muted">لا توجد مواد سيطرة مفعّلة — أضفها من <Link href="/qc/analytes" className="text-brand-dark underline">مواد السيطرة</Link>.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {analytes.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div className="font-bold">{a.name}</div>
              <div className="text-xs text-muted">{a.device}{a.unit && <span dir="ltr"> · {a.unit}</span>}</div>
            </div>
            <div className="flex flex-col gap-3">
              {a.levels.map((l) => {
                const r = results.find((x) => x.analyteId === a.id && x.levelId === l.id && x.date === date);
                const k = key(a.id, l.id);
                const e = r ? evals.get(a.id)?.get(r.id) : undefined;
                const tone = !e ? "" : e.status === "reject" ? "!border-red-400 bg-red-50/60" : e.status === "warn" ? "!border-amber-400 bg-amber-50/60" : "!border-green-400";
                return (
                  <div key={l.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{l.label}{l.lot && <span className="text-xs text-muted" dir="ltr"> · Lot {l.lot}</span>}</span>
                      <span className="text-xs text-muted" dir="ltr">{l.mean} ± {l.sd} (2SD: {+(l.mean - 2 * l.sd).toFixed(3)}–{+(l.mean + 2 * l.sd).toFixed(3)})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        dir="ltr"
                        value={k in drafts ? drafts[k] : r ? String(r.value) : ""}
                        onChange={(ev) => setDrafts((d) => ({ ...d, [k]: ev.target.value }))}
                        onBlur={() => commit(a, l.id)}
                        onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
                        placeholder="القيمة"
                        className={`${inp} text-base font-semibold ${tone}`}
                      />
                      {e && (
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${e.status === "reject" ? "bg-red-600 text-white" : e.status === "warn" ? "bg-amber-400 text-amber-950" : "bg-green-100 text-green-800"}`}>
                          {e.status === "reject" ? <XCircle className="size-3.5" /> : e.status === "warn" ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                          <span dir="ltr">z={e.z.toFixed(1)}</span>
                        </span>
                      )}
                    </div>
                    {e && e.rules.length > 0 && (
                      <div className={`mt-1 rounded-lg px-2.5 py-1.5 text-xs ${e.status === "reject" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
                        {e.rules.map((c) => <div key={c}><b dir="ltr">{c}</b> — {RULES[c].text}</div>)}
                        {e.status === "reject" && <div className="mt-1 font-semibold">لا تعتمد نتائج المرضى لهذا الفحص: أعد الكنترول، وتحقّق من الكاشف والمعايرة والجهاز.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
