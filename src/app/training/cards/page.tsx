"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Shuffle, RotateCcw, Check, Repeat, ArrowRight, ArrowLeft, Lightbulb } from "lucide-react";
import { getTests, getTubes, type TrainingTest, type Tube } from "@/lib/training/store";
import { RichText } from "@/components/training/RichText";

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

/** Quick-review flashcards: front = test name, back = tube, sample, normals, key tip. */
export default function CardsPage() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [cat, setCat] = useState("");
  const [deck, setDeck] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());

  useEffect(() => { setTests(getTests()); setTubes(getTubes()); }, []);
  const cats = useMemo(() => Array.from(new Set(tests.map((t) => t.category?.trim() || "أخرى"))).sort(), [tests]);

  const build = useCallback((mix: boolean) => {
    const ids = tests.filter((t) => !cat || (t.category?.trim() || "أخرى") === cat).map((t) => t.id);
    setDeck(mix ? shuffle(ids) : ids);
    setI(0); setFlipped(false); setKnown(new Set());
  }, [tests, cat]);
  useEffect(() => { build(false); }, [build]);

  const t = tests.find((x) => x.id === deck[i]);
  const done = deck.length > 0 && i >= deck.length;

  const next = useCallback(() => { setFlipped(false); setI((n) => Math.min(n + 1, deck.length)); }, [deck.length]);
  const prev = useCallback(() => { setFlipped(false); setI((n) => Math.max(0, n - 1)); }, []);
  function mark(ok: boolean) {
    if (!t) return;
    if (ok) setKnown((k) => new Set(k).add(t.id));
    else setDeck((d) => [...d, t.id]); // review it again at the end
    next();
  }

  // Keyboard: Space flips, arrows move (RTL: ← next, → previous).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const myTubes = t ? t.tubeIds.map((id) => tubes.find((x) => x.id === id)).filter(Boolean) as Tube[] : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><Layers className="size-6 text-brand" /> بطاقات المراجعة</h1>
      <p className="mb-4 text-sm text-muted">فكّر في الإجابة ثم اقلب البطاقة. «أراجعها» تعيد البطاقة إلى آخر المجموعة.</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="">كل التصنيفات</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => build(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Shuffle className="size-4" /> خلط</button>
        <span className="ms-auto text-xs tabular-nums text-muted">{Math.min(i + 1, deck.length)} / {deck.length} · عرفتُ {known.size}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${deck.length ? (Math.min(i, deck.length) / deck.length) * 100 : 0}%` }} /></div>

      {deck.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">لا توجد فحوصات في هذا التصنيف.</div>
      ) : done ? (
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <Check className="size-10 text-green-600" />
          <div className="mt-2 text-lg font-bold">انتهت المجموعة</div>
          <div className="text-sm text-muted">عرفتَ {known.size} من {new Set(deck).size} بطاقة.</div>
          <button onClick={() => build(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><RotateCcw className="size-4" /> مراجعة من جديد</button>
        </div>
      ) : t && (
        <>
          {/* Card (click to flip) */}
          <div className="[perspective:1200px]">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFlipped((f) => !f)}
              aria-label="اقلب البطاقة"
              className="relative block h-80 w-full cursor-pointer text-right outline-none transition-transform duration-500 [transform-style:preserve-3d]"
              style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
            >
              {/* Front */}
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)] [backface-visibility:hidden]">
                <span className="rounded-full bg-brand-light px-3 py-0.5 text-xs font-medium text-brand-dark">{t.category || "أخرى"}</span>
                {t.abbr && <div className="mt-4 text-4xl font-extrabold text-brand" dir="ltr">{t.abbr}</div>}
                <div className="mt-2 text-2xl font-bold">{t.name_ar}</div>
                {t.name_en && <div className="mt-1 text-sm text-muted" dir="ltr">{t.name_en}</div>}
                <div className="mt-6 text-xs text-muted">التيوب؟ العينة؟ القيمة الطبيعية؟ — اضغط للقلب (مسافة)</div>
              </div>
              {/* Back */}
              <div className="absolute inset-0 flex flex-col gap-3 overflow-y-auto rounded-2xl border-2 border-brand/40 bg-surface p-5 shadow-[var(--shadow-pop)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="text-base font-bold">{t.name_ar}</div>
                {myTubes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {myTubes.map((tb) => <span key={tb.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs"><span className="size-3 rounded-full border border-black/10" style={{ background: tb.color }} />{tb.name}</span>)}
                  </div>
                )}
                {(t.sampleType || t.patientPrep) && (
                  <div className="text-sm"><b>العينة:</b> {t.sampleType || "—"}{t.patientPrep && <span className="text-muted"> · {t.patientPrep.replace(/\*\*|==/g, "")}</span>}</div>
                )}
                {t.normals.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 text-sm">
                    {t.normals.slice(0, 4).map((n, k) => <div key={k} className="rounded-lg bg-canvas px-2.5 py-1.5"><span className="text-xs text-muted">{n.label}</span><div className="font-semibold" dir="ltr" style={{ textAlign: "right" }}>{n.value}</div></div>)}
                  </div>
                )}
                {t.tips[0] && (
                  <div className="flex gap-2 rounded-lg border-r-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950"><Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" /><RichText text={t.tips[0]} /></div>
                )}
                {!myTubes.length && !t.sampleType && !t.normals.length && !t.tips.length && <p className="text-sm text-muted">البطاقة فارغة — أكملها من «تعديل».</p>}
                <Link href={`/training/test/${t.id}`} onClick={(e) => e.stopPropagation()} className="mt-auto text-xs text-brand-dark hover:underline">البطاقة الكاملة ←</Link>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button onClick={prev} disabled={i === 0} title="السابقة" className="grid size-10 place-items-center rounded-lg border border-line hover:bg-canvas"><ArrowRight className="size-4" /></button>
            {flipped ? (
              <div className="flex gap-2">
                <button onClick={() => mark(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"><Repeat className="size-4" /> أراجعها</button>
                <button onClick={() => mark(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"><Check className="size-4" /> عرفتها</button>
              </div>
            ) : (
              <button onClick={() => setFlipped(true)} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">اقلب البطاقة</button>
            )}
            <button onClick={next} title="التالية" className="grid size-10 place-items-center rounded-lg border border-line hover:bg-canvas"><ArrowLeft className="size-4" /></button>
          </div>
        </>
      )}
    </div>
  );
}
