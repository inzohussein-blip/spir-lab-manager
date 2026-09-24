"use client";

import type { TrainingTest, Tube } from "./store";

/** One multiple-choice question generated from the knowledge base. */
export interface QuizQuestion {
  id: string;
  prompt: string;
  /** Quoted context shown under the prompt (e.g. a step or a purpose). */
  context?: string;
  options: string[];
  answer: number; // index into options
  testId: string;
  testName: string;
}

const SAMPLE_POOL = ["مصل (Serum)", "بلازما (Plasma)", "دم كامل (Whole blood)", "إدرار (Urine)", "براز (Stool)", "مسحة (Swab)"];

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
const norm = (s: string) => s.trim().toLowerCase();
/** Display name: adds the abbreviation only when the Arabic name doesn't already contain it. */
const label = (t: TrainingTest) => (t.abbr && !t.name_ar.toLowerCase().includes(t.abbr.toLowerCase()) ? `${t.name_ar} (${t.abbr})` : t.name_ar);
const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Build a question from a correct answer + a pool of wrong ones (needs 3 distinct wrong). */
function mcq(testId: string, testName: string, prompt: string, correct: string, pool: string[], context?: string): QuizQuestion | null {
  const seen = new Set([norm(correct)]);
  const wrong: string[] = [];
  for (const w of shuffle(pool)) {
    if (!w.trim() || seen.has(norm(w))) continue;
    seen.add(norm(w));
    wrong.push(w);
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;
  const options = shuffle([correct, ...wrong]);
  return { id: `${testId}-${prompt}-${correct}`, prompt, context, options, answer: options.indexOf(correct), testId, testName };
}

/** Generate a quiz from the given tests (optionally one category). */
export function buildQuiz(all: TrainingTest[], tubes: Tube[], count: number, category?: string): QuizQuestion[] {
  const pool = category ? all.filter((t) => (t.category?.trim() || "أخرى") === category) : all;
  const cats = Array.from(new Set(all.map((t) => t.category?.trim()).filter(Boolean))) as string[];
  const qs: QuizQuestion[] = [];

  for (const t of pool) {
    const name = label(t);
    const others = all.filter((x) => x.id !== t.id);

    // Which tube?
    if (t.tubeIds.length) {
      const right = tubes.find((x) => x.id === t.tubeIds[Math.floor(Math.random() * t.tubeIds.length)]);
      const wrongTubes = tubes.filter((x) => !t.tubeIds.includes(x.id)).map((x) => x.name);
      if (right) { const q = mcq(t.id, name, `أي تيوب / حاوية تُستعمل لفحص «${name}»؟`, right.name, wrongTubes); if (q) qs.push(q); }
    }
    // Sample type
    if (t.sampleType?.trim()) {
      // Words of the right answer (e.g. "مصل أو بلازما" → مصل, بلازما) must not appear in a wrong option.
      const words = norm(t.sampleType).split(/[\s()/،,]+/).filter((w) => w.length >= 3 && w !== "أو");
      const q = mcq(t.id, name, `ما نوع العينة المطلوبة لفحص «${name}»؟`, t.sampleType.trim(),
        [...SAMPLE_POOL, ...others.map((x) => x.sampleType ?? "")].filter((s) => !words.some((w) => norm(s).includes(w))));
      if (q) qs.push(q);
    }
    // Normal value
    const normals = t.normals.filter((n) => n.value.trim());
    if (normals.length) {
      const n = normals[Math.floor(Math.random() * normals.length)];
      const q = mcq(t.id, name, `ما القيمة الطبيعية لفحص «${name}»${n.label.trim() ? ` — ${n.label.trim()}` : ""}؟`, n.value.trim(),
        others.flatMap((x) => x.normals.map((m) => m.value)));
      if (q) qs.push(q);
    }
    // Which test is ordered for this purpose?
    if (t.purpose?.trim() && others.length >= 3) {
      const q = mcq(t.id, name, "أي فحص يُطلب للغرض التالي؟", name, others.map(label), clip(t.purpose.trim(), 160));
      if (q) qs.push(q);
    }
    // Next step in the procedure
    const steps = t.steps.map((s) => s.text.trim()).filter(Boolean);
    if (steps.length >= 3) {
      const i = Math.floor(Math.random() * (steps.length - 1));
      const wrong = [...steps.filter((_, j) => j !== i && j !== i + 1), ...others.flatMap((x) => x.steps.map((s) => s.text))].map((s) => clip(s));
      const q = mcq(t.id, name, `في فحص «${name}»: ما الخطوة التي تأتي بعد هذه الخطوة؟`, clip(steps[i + 1]), wrong, clip(steps[i], 160));
      if (q) qs.push(q);
    }
    // Category
    if (t.category?.trim() && cats.length >= 4) {
      const q = mcq(t.id, name, `إلى أي تصنيف ينتمي فحص «${name}»؟`, t.category.trim(), cats);
      if (q) qs.push(q);
    }
    // Correlation
    const linked = t.links.map((l) => all.find((x) => x.id === l.id)).filter(Boolean) as TrainingTest[];
    if (linked.length) {
      const right = linked[Math.floor(Math.random() * linked.length)];
      const q = mcq(t.id, name, `أي فحص يرتبط تفسيره بفحص «${name}»؟`, right.name_ar,
        others.filter((x) => !t.links.some((l) => l.id === x.id)).map((x) => x.name_ar));
      if (q) qs.push(q);
    }
  }

  // Spread across tests: shuffle, then prefer one question per test before repeats.
  const shuffled = shuffle(qs);
  const firstPass: QuizQuestion[] = [], rest: QuizQuestion[] = [];
  const used = new Set<string>();
  for (const q of shuffled) (used.has(q.testId) ? rest : (used.add(q.testId), firstPass)).push(q);
  return [...firstPass, ...rest].slice(0, count);
}
