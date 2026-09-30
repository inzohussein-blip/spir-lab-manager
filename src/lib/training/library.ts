/**
 * The training station's full library: every test in the lab station's built-in list, each with
 * its purpose, method, sample, preparation, steps, practical notes, causes of high / low results
 * and common problems. Normal values come from that built-in list (lib/station/defaultTests) so
 * the two stations agree; the training station still keeps its own copy (nothing is linked).
 *
 * The content is in ./libraryData*.ts; procedures shared by many tests (a colorimetric kit, an
 * immunoassay analyser, a rapid cassette…) are written once here.
 */
import { DEFAULT_TESTS } from "@/lib/station/defaultTests";
import type { NormalRange } from "@/lib/station/store";
import type { TrainingTest, TStep, TNormal, TTrouble, Tube, Tool } from "./store";
import { CHEM_SPECS } from "./libraryChem";
import { HORMONE_SPECS } from "./libraryHormones";
import { SEROLOGY_SPECS } from "./librarySerology";

/** One test's content; name, category and normal values come from the lab's built-in list by `code`. */
export interface Spec {
  code: string;
  purpose: string;
  summary: string;
  sampleType: string;
  volume: string;
  patientPrep: string;
  storage: string;
  tubeIds: string[];
  toolIds: string[];
  /** The procedure (a step starting with "!" is a warning step). */
  steps: string[];
  tips: string[];
  high?: string;
  low?: string;
  resultNotes?: string;
  safety?: string;
  links?: [string, string][];
  troubles?: [string, string, string][];
  /** Values shown instead of the built-in range (forms with several parameters). */
  normals?: [string, string][];
}

/** The library's id for a test code (the first library's five keep their ids). */
export const libId = (code: string): string => `x-${code.toLowerCase()}`;
/** Codes already in the first library (written there in full). */
export const FIRST_CODES = ["FBS", "ALT", "AST", "GUE"];

// ── Tubes and tools the library adds to the first ones ─────────────────────────
export const LIB_TUBES: Tube[] = [
  { id: "t-semen", name: "حاوية السائل المنوي المعقّمة", color: "#e5e7eb", additive: "معقّمة واسعة الفتحة، بلا مواد مضافة",
    uses: "تحليل السائل المنوي", notes: "تُكتب عليها ساعة الجمع. لا يُستعمل الواقي الذكري العادي (فيه مواد قاتلة للنطف)." },
  { id: "t-swab", name: "مسحة معقّمة مع وسط نقل", color: "#0ea5e9", additive: "وسط نقل (Amies / Stuart)",
    uses: "زرع الجروح والحلق والمهبل والأذن", notes: "تُرسل خلال ساعتين، أو تُحفظ في وسط النقل حتى 24 ساعة بحرارة الغرفة." },
];
export const LIB_TOOLS: Tool[] = [
  { id: "o-ise", name: "محلل الأملاح (ISE)", kind: "جهاز", description: "يقيس الصوديوم والبوتاسيوم والكلورايد (وبعضها الكالسيوم المتأيّن) بأقطاب انتقائية. يُعاير يومياً ويُنظّف حسب الشركة." },
  { id: "o-immuno", name: "محلل المناعة والهرمونات (CLIA / FIA)", kind: "جهاز", description: "أجهزة مثل Cobas e411 وMini VIDAS وichroma وMaglumi: تقيس الهرمونات والفيتامينات ودلالات المناعة بالكارتردج أو الكاشف الخاص. تحتاج معايرة لكل دفعة (Lot)." },
  { id: "o-elisa", name: "قارئ وغاسل ELISA", kind: "جهاز", description: "صفيحة 96 بئراً: غسل آلي بين المراحل وقراءة الامتصاص عند 450 نانومتر (مرجع 620–630)." },
  { id: "o-rapid", name: "كاسيت الفحص السريع", kind: "كاشف", description: "فحص مناعي كروماتوغرافي بخطين: C (السيطرة) وT (الفحص). يُقرأ في الوقت المحدد فقط." },
  { id: "o-latex", name: "كواشف اللاتكس وشريحة التلازن", kind: "كاشف", description: "شريحة سوداء بدوائر مع كاشف لاتكس وسيطرة موجبة وسالبة (CRP ، RF ، ASO). يُرجّ الكاشف قبل الاستعمال." },
  { id: "o-rotator", name: "هزّاز الشرائح (Rotator)", kind: "جهاز", description: "يحرّك الشريحة دائرياً بسرعة ثابتة (مثلاً 100 دورة/دقيقة لـ RPR)." },
  { id: "o-hba1c", name: "جهاز السكر التراكمي (HbA1c)", kind: "جهاز", description: "بطريقة HPLC أو المناعة أو الألفة (Boronate). يُشغّل عليه السيطرة بمستويين قبل العينات." },
  { id: "o-neubauer", name: "شريحة العدّ (Neubauer / Makler)", kind: "أداة", description: "لعدّ الخلايا يدوياً (الكريات، النطف). تُغطّى بغطائها الخاص وتُعدّ المربعات المحددة." },
  { id: "o-media", name: "أوساط الزرع (Blood / MacConkey / CLED / Mueller-Hinton)", kind: "مستهلكات", description: "تُحفظ في الثلاجة وتُترك لتصل حرارة الغرفة قبل الزرع. يُكتب عليها التاريخ ورقم العينة." },
  { id: "o-loop", name: "العروة المعايرة واللهب / حاضنة 37°م", kind: "أداة", description: "عروة 1 أو 10 ميكرولتر لعدّ المستعمرات في الإدرار. تُعقّم باللهب حتى الاحمرار وتُبرّد قبل اللمس." },
  { id: "o-discs", name: "أقراص المضادات الحيوية", kind: "مستهلكات", description: "تُحفظ مجمّدة أو في الثلاجة مع مجفف، وتُترك لتصل حرارة الغرفة قبل فتحها لمنع الرطوبة." },
  { id: "o-gram", name: "صبغة غرام", kind: "كاشف", description: "كريستال بنفسجي ← يود ← كحول (إزالة اللون) ← سفرانين. موجب غرام بنفسجي، سالب غرام أحمر." },
  { id: "o-kit", name: "كِت الفحص ونشرته (Insert)", kind: "كاشف", description: "تُتّبع النشرة المرفقة مع كل دفعة (Lot): الحجوم والأوقات وطول الموجة والمعامل وحدود القياس." },
];

// ── Assembly ──────────────────────────────────────────────────────────────────
const SPECS: Spec[] = [...CHEM_SPECS, ...HORMONE_SPECS, ...SEROLOGY_SPECS];

const num = (v: number | null) => (v == null ? "" : String(v));
function band(low: number | null, high: number | null, unit: string): string {
  const u = unit ? ` ${unit}` : "";
  if (low != null && high != null) return `${num(low)} – ${num(high)}${u}`;
  if (high != null) return `أقل من ${num(high)}${u}`;
  if (low != null) return `أكثر من ${num(low)}${u}`;
  return "—";
}
/** The built-in range as the training station's «القيم الطبيعية» rows. */
export function normalRows(r: NormalRange, unit: string): TNormal[] {
  switch (r.kind) {
    case "numeric": return [{ label: r.note || "الطبيعي", value: band(r.low, r.high, unit) }];
    case "sex": {
      const rows = [{ label: "ذكور", value: band(r.male.low, r.male.high, unit) }];
      if (r.female.low != null || r.female.high != null) rows.push({ label: "إناث", value: band(r.female.low, r.female.high, unit) });
      return r.note ? [...rows, { label: "ملاحظة", value: r.note }] : rows;
    }
    case "qual": return [{ label: "الطبيعي", value: r.text }];
    case "text": return [{ label: "الطبيعي", value: r.text }];
    default: return [];
  }
}

let n = 0;
const sid = () => `lib-${Date.now().toString(36)}-${(n++).toString(36)}`;

/** The library's tests (not the first five), ready to add to the training station. */
export function libraryTests(): TrainingTest[] {
  const catalog = new Map(DEFAULT_TESTS().map((t) => [t.code, t]));
  const now = Date.now();
  return SPECS.flatMap((s): TrainingTest[] => {
    const c = catalog.get(s.code);
    if (!c) return [];
    const steps: TStep[] = s.steps.map((x) => (x.startsWith("!") ? { id: sid(), text: x.slice(1), warn: true } : { id: sid(), text: x }));
    const troubles: TTrouble[] = (s.troubles ?? []).map(([problem, cause, fix]) => ({ id: sid(), problem, cause, fix }));
    return [{
      id: libId(s.code), name_ar: c.name_ar, name_en: c.name_en, abbr: s.code === "HBA1C" ? "HbA1c" : s.code, category: c.category,
      purpose: s.purpose, summary: s.summary, sampleType: s.sampleType, volume: s.volume, patientPrep: s.patientPrep, storage: s.storage,
      tubeIds: s.tubeIds, toolIds: s.toolIds, steps, tips: s.tips, ...(s.safety ? { safety: s.safety } : {}),
      normals: s.normals ? s.normals.map(([label, value]) => ({ label, value })) : normalRows(c.normal, c.unit ?? ""),
      high: s.high ?? "", low: s.low ?? "", resultNotes: s.resultNotes ?? "",
      gallery: [], links: (s.links ?? []).map(([id, note]) => ({ id, note })), troubles, updated_at: now,
    }];
  });
}
/** Every code the library covers (with the first five) — for checks. */
export const LIBRARY_CODES = (): string[] => [...FIRST_CODES, ...SPECS.map((s) => s.code)];
