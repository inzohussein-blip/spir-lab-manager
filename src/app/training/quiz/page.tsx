"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrainCircuit, Play, Check, X, RotateCcw, ArrowLeft, Trophy } from "lucide-react";
import {
  getTests, getTubes, getTrainees, getQuizHistory, addQuizAttempt,
  type TrainingTest, type Tube, type Trainee, type QuizAttempt,
} from "@/lib/training/store";
import { buildQuiz, type QuizQuestion } from "@/lib/training/quiz";

type Phase = "setup" | "run" | "done";

export default function QuizPage() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [cat, setCat] = useState("");
  const [count, setCount] = useState(10);
  const [traineeId, setTraineeId] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { setTests(getTests()); setTubes(getTubes()); setTrainees(getTrainees()); setHistory(getQuizHistory()); }, []);
  const cats = useMemo(() => Array.from(new Set(tests.map((t) => t.category?.trim() || "أخرى"))).sort(), [tests]);

  function start() {
    const q = buildQuiz(tests, tubes, count, cat || undefined);
    if (q.length === 0) { setMsg("لا توجد معلومات كافية لتوليد أسئلة — أكمل بطاقات الفحوصات (التيوب، القيم الطبيعية، الخطوات…)."); return; }
    setMsg(""); setQs(q); setI(0); setPicked(null); setAnswers([]); setPhase("run");
  }
  function pick(k: number) {
    if (picked !== null) return;
    setPicked(k);
    setAnswers((a) => [...a, k]);
  }
  function next() {
    if (i + 1 < qs.length) { setI(i + 1); setPicked(null); return; }
    const score = qs.reduce((s, q, k) => s + (answers[k] === q.answer ? 1 : 0), 0);
    addQuizAttempt({ at: Date.now(), score, total: qs.length, ...(cat ? { category: cat } : {}) }, traineeId || undefined);
    setHistory(getQuizHistory());
    setPhase("done");
  }

  const score = qs.reduce((s, q, k) => s + (answers[k] === q.answer ? 1 : 0), 0);
  const pct = qs.length ? Math.round((score / qs.length) * 100) : 0;
  const q = qs[i];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><BrainCircuit className="size-6 text-brand" /> اختبر نفسك</h1>
      <p className="mb-5 text-sm text-muted">أسئلة تُولَّد تلقائياً من محتوى المكتبة: التيوب المناسب، نوع العينة، القيم الطبيعية، ترتيب الخطوات، الربط بين الفحوصات…</p>

      {phase === "setup" && (
        <>
          <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-3">
            <label className="text-sm font-medium">التصنيف
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <option value="">كل التصنيفات</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">عدد الأسئلة
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">المتدرب (اختياري)
              <select value={traineeId} onChange={(e) => setTraineeId(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <option value="">— بدون —</option>
                {trainees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div className="sm:col-span-3">
              <button onClick={start} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"><Play className="size-4" /> ابدأ الاختبار</button>
              {msg && <p className="mt-2 text-sm text-amber-700">{msg}</p>}
            </div>
          </div>
          {history.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-2 text-sm font-bold">آخر المحاولات</div>
              <div className="flex flex-col gap-1.5">
                {history.slice(0, 8).map((h, k) => (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <span className="w-24 text-xs text-muted" dir="ltr">{new Date(h.at).toLocaleDateString("en-CA")}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand" style={{ width: `${(h.score / h.total) * 100}%` }} /></div>
                    <b className="w-14 text-left tabular-nums" dir="ltr">{h.score}/{h.total}</b>
                    <span className="w-28 truncate text-xs text-muted">{h.category ?? "الكل"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {phase === "run" && q && (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-3 text-xs text-muted">
            <span className="tabular-nums">السؤال {i + 1} من {qs.length}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${((i + (picked !== null ? 1 : 0)) / qs.length) * 100}%` }} /></div>
          </div>
          <div className="text-lg font-bold">{q.prompt}</div>
          {q.context && <div className="mt-2 rounded-lg border-r-4 border-brand bg-brand-light px-3 py-2 text-sm">«{q.context}»</div>}
          <div className="mt-4 flex flex-col gap-2">
            {q.options.map((o, k) => {
              const state = picked === null ? "" : k === q.answer ? "right" : k === picked ? "wrong" : "dim";
              return (
                <button
                  key={k}
                  onClick={() => pick(k)}
                  disabled={picked !== null && state === "dim"}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-right text-sm transition-colors ${
                    state === "right" ? "border-green-500 bg-green-50 font-semibold text-green-800"
                    : state === "wrong" ? "border-red-400 bg-red-50 text-red-800"
                    : state === "dim" ? "border-line opacity-60"
                    : "border-line hover:border-brand hover:bg-brand-light/50"}`}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-xs">
                    {state === "right" ? <Check className="size-3.5" /> : state === "wrong" ? <X className="size-3.5" /> : ["أ", "ب", "ج", "د"][k]}
                  </span>
                  <span className="flex-1" dir="auto">{o}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold ${picked === q.answer ? "text-green-700" : "text-red-700"}`}>
                {picked === q.answer ? "إجابة صحيحة ✓" : "إجابة خاطئة"}
              </span>
              <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                {i + 1 < qs.length ? "التالي" : "النتيجة"} <ArrowLeft className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
            <Trophy className={`size-10 ${pct >= 80 ? "text-amber-500" : pct >= 50 ? "text-brand" : "text-muted"}`} />
            <div className="mt-2 text-3xl font-extrabold tabular-nums" dir="ltr">{score} / {qs.length}</div>
            <div className="text-sm text-muted">{pct}% — {pct >= 80 ? "ممتاز" : pct >= 50 ? "جيد، راجع الأخطاء" : "تحتاج مراجعة المكتبة"}</div>
            {traineeId && <div className="mt-1 text-xs text-brand-dark">سُجّلت النتيجة في سجل المتدرب.</div>}
            <div className="mt-4 flex gap-2">
              <button onClick={start} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><RotateCcw className="size-4" /> اختبار جديد</button>
              <button onClick={() => setPhase("setup")} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">الإعدادات</button>
            </div>
          </div>
          {qs.some((qq, k) => answers[k] !== qq.answer) && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 text-sm font-bold">راجع الأخطاء</div>
              <div className="flex flex-col gap-3">
                {qs.map((qq, k) => answers[k] === qq.answer ? null : (
                  <div key={qq.id} className="rounded-xl border border-line p-3 text-sm">
                    <div className="font-semibold">{qq.prompt}</div>
                    {qq.context && <div className="mt-1 text-xs text-muted">«{qq.context}»</div>}
                    <div className="mt-1.5 text-red-700">إجابتك: {qq.options[answers[k]]}</div>
                    <div className="text-green-700">الصحيح: {qq.options[qq.answer]}</div>
                    <Link href={`/training/test/${qq.testId}`} className="mt-1 inline-block text-xs text-brand-dark hover:underline">افتح بطاقة الفحص ←</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
