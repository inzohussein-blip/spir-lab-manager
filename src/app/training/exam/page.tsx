"use client";

import { useEffect, useMemo, useState } from "react";
import { FileQuestion, Printer, RefreshCw } from "lucide-react";
import { getTests, getTubes, getSettings, today, type TrainingTest, type Tube, type TrainingSettings } from "@/lib/training/store";
import { buildQuiz, type QuizQuestion } from "@/lib/training/quiz";
import { LockGate } from "@/components/training/LockGate";
import { SopPrintStyle, SopLetterhead, SopFooter, SOP_INK, SOP_ACCENT, exact } from "@/components/training/SopSheet";

const LETTERS = ["أ", "ب", "ج", "د"];
const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** Printable written exam generated from the library, with a separate answer-key page.
 *  Supervisor tool — needs the PIN when read-only mode is on (the key must not leak). */
export default function ExamPage() {
  return <LockGate><Exam /></LockGate>;
}

function Exam() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [title, setTitle] = useState("اختبار تحريري");
  const [cat, setCat] = useState("");
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState("");
  const [withKey, setWithKey] = useState(true);
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { setTests(getTests()); setTubes(getTubes()); setSettings(getSettings()); }, []);
  const cats = useMemo(() => Array.from(new Set(tests.map((t) => t.category?.trim() || "أخرى"))).sort(), [tests]);

  function generate() {
    const q = buildQuiz(tests, tubes, count, cat || undefined);
    if (!q.length) { setQs([]); setMsg("لا توجد معلومات كافية لتوليد أسئلة — أكمل بطاقات الفحوصات (التيوب، القيم الطبيعية، الخطوات…)."); return; }
    setMsg(q.length < count ? `تم توليد ${q.length} سؤالاً فقط — هذا أقصى ما تسمح به معلومات المكتبة الحالية.` : "");
    setQs(q);
  }
  useEffect(() => { if (tests.length) generate(); /* first paper on load */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests.length]);

  if (!settings) return null;
  const meta = [cat || "كل التصنيفات", `${qs.length} سؤالاً`, minutes.trim() ? `المدة: ${minutes.trim()} دقيقة` : ""].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="no-print mb-5">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><FileQuestion className="size-6 text-brand" /> ورقة امتحان</h1>
        <p className="mb-4 text-sm text-muted">ورقة أسئلة اختيار من متعدد تُولَّد من محتوى المكتبة للطباعة وتوزيعها على المتدربين، مع ورقة إجابات نموذجية منفصلة للمصحّح.</p>

        <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_0.8fr_0.8fr]">
          <div className="text-xs text-muted">عنوان الامتحان<input value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${inp}`} /></div>
          <div className="text-xs text-muted">التصنيف
            <select value={cat} onChange={(e) => setCat(e.target.value)} className={`mt-1 ${inp}`}>
              <option value="">كل التصنيفات</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="text-xs text-muted">عدد الأسئلة
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`mt-1 ${inp}`}>
              {[10, 15, 20, 25, 30, 40, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="text-xs text-muted">المدة (دقيقة)<input dir="ltr" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="اختياري" className={`mt-1 ${inp}`} /></div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <button onClick={generate} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm hover:bg-canvas"><RefreshCw className="size-4" /> توليد أسئلة جديدة</button>
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} className="accent-[var(--color-brand)]" /> طباعة ورقة الإجابات النموذجية (صفحة منفصلة)
            </label>
            <button onClick={() => window.print()} disabled={!qs.length} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"><Printer className="size-4" /> طباعة</button>
          </div>
        </div>
        {msg && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{msg}</p>}
        {qs.length > 0 && <p className="mt-4 text-xs text-muted">معاينة الورقة كما ستُطبع:</p>}
      </div>

      {qs.length > 0 && (
        <div className="mx-auto max-w-[210mm] rounded-2xl border border-line bg-white p-8 text-black shadow-[var(--shadow-card)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="sop-doc text-[12px]">
            <SopPrintStyle />
            <SopLetterhead settings={settings} right={<><div className="font-bold" style={{ color: SOP_ACCENT }}>{title || "امتحان"}</div><div>{meta}</div></>} />

            <div className="mt-3 grid grid-cols-[2fr_1fr_1fr] gap-3 rounded-md border border-gray-300 px-3 py-2.5 text-[12px]">
              <div>اسم المتدرب: <span className="inline-block w-[60%] border-b border-dotted border-gray-500" /></div>
              <div>التاريخ: <span className="inline-block w-[55%] border-b border-dotted border-gray-500" /></div>
              <div>الدرجة: <span className="inline-block w-10 border-b border-dotted border-gray-500" /> / <b dir="ltr">{qs.length}</b></div>
            </div>
            <p className="mt-2 text-[11px] text-gray-600">اختر إجابة واحدة صحيحة لكل سؤال بتظليل الدائرة المناسبة.</p>

            <ol className="mt-3 flex flex-col gap-3">
              {qs.map((q, n) => (
                <li key={q.id} className="sop-keep">
                  <div className="flex gap-2 font-semibold">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] text-white" style={{ background: SOP_INK, ...exact }}>{n + 1}</span>
                    <span>{q.prompt}</span>
                  </div>
                  {q.context && <div className="mt-1 me-2 ms-7 rounded border-r-2 bg-gray-50 px-2 py-1 text-[11px] text-gray-700" style={{ borderColor: SOP_ACCENT, ...exact }}>«{q.context}»</div>}
                  <div className="ms-7 mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                    {q.options.map((o, k) => (
                      <div key={k} className="flex items-start gap-1.5">
                        <span className="mt-[1px] grid size-4 shrink-0 place-items-center rounded-full border border-gray-500 text-[9px]">{LETTERS[k]}</span>
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>

            {withKey && (
              <div className="sop-page-break mt-8 border-t-2 border-dashed border-gray-300 pt-6 print:mt-0 print:border-0 print:pt-0">
                <SopLetterhead settings={settings} right={<><div className="font-bold" style={{ color: SOP_ACCENT }}>الإجابات النموذجية — للمصحّح فقط</div><div>{title} · <span dir="ltr">{today()}</span></div></>} />
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {qs.map((q, n) => (
                    <div key={q.id} className="flex items-center justify-between rounded border border-gray-300 px-2 py-1">
                      <b dir="ltr">{n + 1}</b><span className="font-bold" style={{ color: SOP_ACCENT }}>{LETTERS[q.answer]}</span>
                    </div>
                  ))}
                </div>
                <table className="mt-4 w-full border-collapse text-[11px]">
                  <thead><tr style={{ background: "#eef2ff", ...exact }}><th className="w-8 border border-gray-300 p-1">#</th><th className="border border-gray-300 p-1 text-right">الإجابة الصحيحة</th><th className="border border-gray-300 p-1 text-right">الفحص (للمراجعة)</th></tr></thead>
                  <tbody>
                    {qs.map((q, n) => (
                      <tr key={q.id}>
                        <td className="border border-gray-300 p-1 text-center" dir="ltr">{n + 1}</td>
                        <td className="border border-gray-300 p-1"><b>{LETTERS[q.answer]})</b> {q.options[q.answer]}</td>
                        <td className="border border-gray-300 p-1 text-gray-600">{q.testName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <SopFooter text={settings.footer} />
          </div>
        </div>
      )}
    </div>
  );
}
