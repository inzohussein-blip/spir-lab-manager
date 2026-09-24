"use client";

/**
 * Local store for the standalone Training & Information station — a knowledge
 * base of lab tests (procedures, samples, tubes, tools, interpretation,
 * correlations). Text lives in localStorage under "training.*"; images live in
 * IndexedDB (see ./media). Fully separate: nothing here reads or writes the
 * Lab Station, Purchasing, or the admin panel.
 */

import { exportImages, importImages, type MediaExport } from "./media";

export interface TStep { id: string; text: string; imageId?: string; warn?: boolean }
export interface TGalleryItem { id: string; imageId: string; caption: string }
export interface TLink { id: string; note?: string }
export interface TNormal { label: string; value: string }

export interface TrainingTest {
  id: string;
  name_ar: string;
  name_en?: string;
  abbr?: string;
  category?: string;
  coverImageId?: string;
  /** Why the doctor orders it. */
  purpose?: string;
  /** Short summary / principle of the method. */
  summary?: string;
  sampleType?: string;
  volume?: string;
  patientPrep?: string;
  /** Stability, storage and transport. */
  storage?: string;
  tubeIds: string[];
  toolIds: string[];
  steps: TStep[];
  /** "Golden notes" — practical experience, common errors, tricks. */
  tips: string[];
  safety?: string;
  normals: TNormal[];
  high?: string;
  low?: string;
  /** How the sample / result looks, interferences (hemolysis, lipemia…). */
  resultNotes?: string;
  gallery: TGalleryItem[];
  links: TLink[];
  updated_at: number;
}

export interface Tube {
  id: string;
  name: string;
  color: string; // cap colour (hex)
  additive?: string;
  uses?: string;
  notes?: string;
  imageId?: string;
}

export interface Tool {
  id: string;
  name: string;
  kind: string; // أداة / جهاز / كاشف / مستهلكات
  description?: string;
  imageId?: string;
}

export interface TrainingSettings {
  title: string;
  subtitle: string;
  footer?: string;
  logoImageId?: string;
  /** Printed in the SOP safety box when a test has none of its own. */
  defaultSafety: string;
  preparedBy?: string;
}

const K_TESTS = "training.tests.v1";
const K_TUBES = "training.tubes.v1";
const K_TOOLS = "training.tools.v1";
const K_SETTINGS = "training.settings.v1";
const K_SEEDED = "training.seeded.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** First run: load the starter library (tubes, tools, example tests). */
function ensureSeed(): void {
  if (read<boolean>(K_SEEDED, false)) return;
  const s = seedData();
  write(K_TUBES, s.tubes);
  write(K_TOOLS, s.tools);
  write(K_TESTS, s.tests);
  write(K_SEEDED, true);
}

// ── Tests ────────────────────────────────────────────────────────────────────
export function getTests(): TrainingTest[] { ensureSeed(); return read<TrainingTest[]>(K_TESTS, []); }
export function getTest(id: string): TrainingTest | null { return getTests().find((t) => t.id === id) ?? null; }
export function saveTest(t: TrainingTest): void {
  const all = getTests();
  const rec = { ...t, updated_at: Date.now() };
  write(K_TESTS, all.some((x) => x.id === t.id) ? all.map((x) => (x.id === t.id ? rec : x)) : [...all, rec]);
}
/** Delete a test and remove every link that points to it. */
export function deleteTest(id: string): void {
  write(K_TESTS, getTests().filter((t) => t.id !== id).map((t) => ({ ...t, links: t.links.filter((l) => l.id !== id) })));
}
export function blankTest(): TrainingTest {
  return {
    id: uid(), name_ar: "", tubeIds: [], toolIds: [], steps: [], tips: [], normals: [],
    gallery: [], links: [], updated_at: Date.now(),
  };
}
/** Tests that link TO this one (reverse side of the correlation network). */
export function backlinks(id: string): { test: TrainingTest; note?: string }[] {
  const out: { test: TrainingTest; note?: string }[] = [];
  for (const t of getTests()) {
    const l = t.links.find((x) => x.id === id);
    if (l && t.id !== id) out.push({ test: t, note: l.note });
  }
  return out;
}

/** Remove a deleted tube/tool from every test that referenced it. */
export function unlinkFromTests(field: "tubeIds" | "toolIds", id: string): void {
  write(K_TESTS, getTests().map((t) => ({ ...t, [field]: t[field].filter((x) => x !== id) })));
}
/** Number of tests using a tube/tool. */
export function usageCount(field: "tubeIds" | "toolIds", id: string): number {
  return getTests().filter((t) => t[field].includes(id)).length;
}

/** Where an image is used (tests, tubes, tools, logo) — shown before deleting. */
export function imageUsage(imageId: string): string[] {
  const out: string[] = [];
  for (const t of getTests()) {
    if (t.coverImageId === imageId || t.steps.some((s) => s.imageId === imageId) || t.gallery.some((g) => g.imageId === imageId)) out.push(t.name_ar);
  }
  for (const t of getTubes()) if (t.imageId === imageId) out.push(t.name);
  for (const t of getTools()) if (t.imageId === imageId) out.push(t.name);
  if (getSettings().logoImageId === imageId) out.push("شعار الطباعة");
  return out;
}
/** Drop every reference to a deleted image. */
export function removeImageRefs(imageId: string): void {
  write(K_TESTS, getTests().map((t) => ({
    ...t,
    coverImageId: t.coverImageId === imageId ? undefined : t.coverImageId,
    steps: t.steps.map((s) => (s.imageId === imageId ? { ...s, imageId: undefined } : s)),
    gallery: t.gallery.filter((g) => g.imageId !== imageId),
  })));
  write(K_TUBES, getTubes().map((t) => (t.imageId === imageId ? { ...t, imageId: undefined } : t)));
  write(K_TOOLS, getTools().map((t) => (t.imageId === imageId ? { ...t, imageId: undefined } : t)));
  const st = getSettings();
  if (st.logoImageId === imageId) write(K_SETTINGS, { ...st, logoImageId: undefined });
}

// ── Tubes & tools ────────────────────────────────────────────────────────────
export function getTubes(): Tube[] { ensureSeed(); return read<Tube[]>(K_TUBES, []); }
export function saveTubes(list: Tube[]): void { write(K_TUBES, list); }
export function getTools(): Tool[] { ensureSeed(); return read<Tool[]>(K_TOOLS, []); }
export function saveTools(list: Tool[]): void { write(K_TOOLS, list); }

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): TrainingSettings {
  return read<TrainingSettings>(K_SETTINGS, {
    title: "مختبر التحليلات المرضية",
    subtitle: "دليل العمل والتدريب",
    footer: "النجف الأشرف - حي ميسان - مقابل بريد ميسان / 0789038080",
    defaultSafety:
      "ارتدِ القفازات والصدرية ونظارات الوقاية.\nتعامل مع كل عينة على أنها معدية محتملة.\nتخلّص من الإبر في حاوية الأدوات الحادة فوراً ومن النفايات في الأكياس الصفراء.\nشغّل عينة سيطرة (QC) قبل عينات المرضى ودوّن نتيجتها.\nعقّم سطح العمل بعد الانتهاء.",
  });
}
export function saveSettings(s: TrainingSettings): void { write(K_SETTINGS, s); }

/** Text storage used in localStorage (bytes, approx.). */
export function textUsage(): number {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("training.")) bytes += (k.length + (localStorage.getItem(k) ?? "").length) * 2;
    }
  } catch { /* ignore */ }
  return bytes;
}

// ── Backup (text + images in one file) ───────────────────────────────────────
export interface TrainingBackup {
  app: "spir-training";
  version: 1;
  exported_at: string;
  tests: TrainingTest[];
  tubes: Tube[];
  tools: Tool[];
  settings: TrainingSettings;
  images: MediaExport[];
}
export async function exportBackup(): Promise<TrainingBackup> {
  return {
    app: "spir-training", version: 1, exported_at: new Date().toISOString(),
    tests: getTests(), tubes: getTubes(), tools: getTools(), settings: getSettings(),
    images: await exportImages(),
  };
}
export async function importBackup(data: unknown): Promise<boolean> {
  const b = data as Partial<TrainingBackup>;
  if (!b || b.app !== "spir-training" || !Array.isArray(b.tests)) return false;
  write(K_TESTS, b.tests);
  if (b.tubes) write(K_TUBES, b.tubes);
  if (b.tools) write(K_TOOLS, b.tools);
  if (b.settings) write(K_SETTINGS, b.settings);
  write(K_SEEDED, true);
  if (Array.isArray(b.images)) await importImages(b.images);
  return true;
}

// ── Starter library (editable/deletable by the user) ─────────────────────────
function seedData(): { tubes: Tube[]; tools: Tool[]; tests: TrainingTest[] } {
  const tube = (id: string, name: string, color: string, additive: string, uses: string, notes = ""): Tube =>
    ({ id, name, color, additive, uses, notes });
  const tubes: Tube[] = [
    tube("t-citrate", "تيوب السترات (أزرق فاتح)", "#38bdf8", "سترات الصوديوم 3.2% (نسبة 1:9)", "PT ، APTT ، INR ، فحوصات التخثر",
      "يجب ملؤه حتى الخط تماماً — النقص يغيّر نسبة المانع للدم ويعطي نتائج تخثر خاطئة. يُقلب 3–4 مرات بلطف."),
    tube("t-plain", "تيوب عادي (أحمر)", "#dc2626", "بدون مادة مضافة / منشّط تخثر", "الكيمياء ، المصليات ، الهرمونات",
      "اترك العينة 20–30 دقيقة حتى تتخثر كاملاً قبل الطرد المركزي."),
    tube("t-gel", "تيوب الجل (أصفر / ذهبي)", "#eab308", "منشّط تخثر + جل فاصل (SST)", "الكيمياء ، الهرمونات ، المصليات ، الفيتامينات",
      "يُقلب 5 مرات ويُترك 30 دقيقة ثم يُطرد. الجل يفصل المصل عن الخلايا فيحافظ على ثبات العينة."),
    tube("t-heparin", "تيوب الهيبارين (أخضر)", "#16a34a", "هيبارين الليثيوم", "كيمياء البلازما ، الأملاح ، الغازات",
      "لا يُستعمل لقياس الليثيوم. يُقلب 8–10 مرات."),
    tube("t-edta", "تيوب EDTA (بنفسجي)", "#7c3aed", "K2 / K3 EDTA", "CBC ، فصيلة الدم ، HbA1c ، الشريحة الدموية",
      "يُقلب 8–10 مرات بلطف فور السحب لمنع التجلط. لا تهزّه بقوة (يسبب تكسّر الكريات)."),
    tube("t-fluoride", "تيوب الفلورايد (رمادي)", "#6b7280", "فلوريد الصوديوم + أوكزالات البوتاسيوم", "السكر ، اللاكتيت",
      "الفلورايد يوقف استهلاك الخلايا للسكر، فيبقى السكر ثابتاً لساعات."),
    tube("t-esr", "تيوب ESR (أسود)", "#111827", "سترات الصوديوم 3.8% (نسبة 1:4)", "سرعة الترسيب ESR (ويسترغرين)",
      "يُملأ حتى الخط ويُقرأ بعد ساعة تماماً والأنبوب عمودي بعيداً عن الاهتزاز والشمس."),
    tube("t-urine", "حاوية الإدرار المعقّمة", "#fcd34d", "معقّمة بغطاء محكم", "فحص الإدرار العام ، الزرع ، هرمون الحمل",
      "العينة الوسطى من أول إدرار صباحي أفضل. تُفحص خلال ساعة إلى ساعتين."),
    tube("t-stool", "حاوية البراز", "#92400e", "نظيفة بملعقة", "فحص البراز العام ، مستضد جرثومة المعدة ، الدم الخفي",
      "كمية بحجم حبة البندق تكفي. تُفحص طازجة خصوصاً للطفيليات المتحركة."),
  ];
  const tool = (id: string, name: string, kind: string, description: string): Tool => ({ id, name, kind, description });
  const tools: Tool[] = [
    tool("o-centrifuge", "جهاز الطرد المركزي (Centrifuge)", "جهاز", "لفصل المصل/البلازما عن الخلايا — عادة 3000 دورة/دقيقة لمدة 10 دقائق. وازن الأنابيب دائماً قبل التشغيل."),
    tool("o-micropipette", "الماصات الدقيقة (Micropipettes)", "أداة", "لسحب حجوم دقيقة (10–1000 µL). اضغط للتوقف الأول عند السحب وللثاني عند التفريغ، وغيّر الرأس لكل عينة."),
    tool("o-tips", "رؤوس الماصات (Tips)", "مستهلكات", "أصفر للحجوم الصغيرة وأزرق للكبيرة. رأس جديد لكل عينة وكاشف."),
    tool("o-spectro", "جهاز المطياف الضوئي / محلل الكيمياء", "جهاز", "يقيس امتصاص الضوء عند طول موجي محدد لحساب التركيز. يُصفَّر على البلانك قبل القراءة."),
    tool("o-hema", "جهاز تحليل الدم (Hematology Analyzer)", "جهاز", "يعدّ الكريات ويحسب مؤشراتها (CBC). شغّل الـ QC يومياً وراجع الإنذارات (Flags)."),
    tool("o-microscope", "المجهر الضوئي", "جهاز", "ابدأ بالعدسة 10x ثم 40x. عدسة 100x تحتاج زيت الغمر."),
    tool("o-incubator", "الحمّام المائي / الحاضنة 37°م", "جهاز", "لحضن التفاعلات عند 37°م. تحقّق من الحرارة يومياً بمحرار."),
    tool("o-slides", "الشرائح والأغطية الزجاجية", "مستهلكات", "للفحص المجهري للإدرار والشرائح الدموية."),
    tool("o-dipstick", "شريط تحليل الإدرار (Dipstick)", "كاشف", "يُغمس 1–2 ثانية ويُقرأ في الوقت المحدد لكل مربع حسب الشركة."),
    tool("o-glucose", "كاشف السكر (GOD-POD)", "كاشف", "طريقة إنزيمية لونية تُقرأ عند 500–546 نانومتر."),
    tool("o-altreagent", "كاشف ALT / AST (Kinetic)", "كاشف", "طريقة حركية تُقرأ عند 340 نانومتر بقياس تغيّر الامتصاص في الدقيقة."),
    tool("o-phlebotomy", "أدوات السحب (رباط ، إبرة ، حامل)", "أداة", "لا يُترك الرباط أكثر من دقيقة واحدة. عقّم الموضع واتركه يجف قبل الوخز."),
    tool("o-timer", "المؤقّت (Timer)", "أداة", "لضبط أوقات الحضن والقراءة بدقة."),
  ];

  const step = (text: string, warn = false): TStep => ({ id: uid(), text, ...(warn ? { warn } : {}) });
  const now = Date.now();
  const base = { gallery: [] as TGalleryItem[], updated_at: now };

  const tests: TrainingTest[] = [
    {
      ...base, id: "x-fbs", name_ar: "سكر الدم الصائم", name_en: "Fasting Blood Sugar", abbr: "FBS", category: "الكيمياء السريرية",
      purpose: "تشخيص داء السكري ومتابعته، والكشف عن انخفاض السكر.",
      summary: "طريقة إنزيمية لونية (GOD-POD): يتأكسد الغلوكوز بإنزيم الغلوكوز أوكسيديز ويتكوّن لون تتناسب شدته مع تركيز السكر.",
      sampleType: "مصل أو بلازما", volume: "2–3 مل دم", patientPrep: "صيام 8–12 ساعة (الماء مسموح).",
      storage: "يُفصل المصل خلال 30–60 دقيقة. في تيوب الفلورايد يبقى ثابتاً حتى 24 ساعة.",
      tubeIds: ["t-fluoride", "t-gel"], toolIds: ["o-centrifuge", "o-micropipette", "o-glucose", "o-incubator", "o-spectro", "o-timer"],
      steps: [
        step("تأكّد من اسم المريض ومدة الصيام قبل السحب."),
        step("اطرد العينة 10 دقائق عند 3000 دورة/دقيقة وافصل المصل خلال ساعة من السحب."),
        step("أوصل الكاشف والعيارية (Standard) إلى حرارة الغرفة."),
        step("حضّر 3 أنابيب: بلانك (1000 µL كاشف) — عيارية (1000 µL كاشف + 10 µL Standard) — عينة (1000 µL كاشف + 10 µL مصل)."),
        step("امزج واحضن 10 دقائق عند 37°م (أو 20 دقيقة بحرارة الغرفة)."),
        step("صفّر الجهاز على البلانك واقرأ الامتصاص عند 500–546 نانومتر خلال 60 دقيقة."),
        step("الحساب: (امتصاص العينة ÷ امتصاص العيارية) × تركيز العيارية."),
      ],
      tips: [
        "ترك الدم دون فصل يُنقص السكر حوالي 5–7% كل ساعة لأن الخلايا تستهلكه — افصل بسرعة أو استعمل تيوب الفلورايد.",
        "العينة المتحللة (Hemolyzed) أو الدهنية (Lipemic) تشوّش القراءة اللونية.",
        "لا تسحب من الذراع التي فيها مغذّي (Drip) لأن المحلول يرفع السكر زوراً.",
      ],
      normals: [{ label: "صائم", value: "70 – 99 mg/dL" }, { label: "ما قبل السكري", value: "100 – 125 mg/dL" }, { label: "سكري", value: "≥ 126 mg/dL (مرتين)" }],
      high: "داء السكري ، الإجهاد ، الكورتيزون ، التهاب البنكرياس ، عدم الصيام.",
      low: "جرعة إنسولين أو حبوب زائدة ، صيام طويل ، ورم الإنسولين ، تأخر فصل العينة.",
      resultNotes: "المصل الطبيعي أصفر شفاف. الأحمر = متحلل ، الحليبي = دهني — دوّن ذلك مع النتيجة.",
      links: [{ id: "x-gue", note: "عند تجاوز السكر ~180 mg/dL يظهر السكر في الإدرار." }],
    },
    {
      ...base, id: "x-cbc", name_ar: "صورة الدم الكاملة", name_en: "Complete Blood Count", abbr: "CBC", category: "أمراض الدم",
      purpose: "تقييم فقر الدم والالتهابات واضطرابات الصفائح.",
      summary: "عدّ آلي للكريات الحمر والبيض والصفائح وقياس الهيموغلوبين وحساب المؤشرات (MCV ، MCH ، MCHC).",
      sampleType: "دم كامل", volume: "2 مل (حتى خط التيوب)", patientPrep: "لا يحتاج صياماً.",
      storage: "يُفحص خلال 6 ساعات بحرارة الغرفة، أو حتى 24 ساعة في الثلاجة (2–8°م).",
      tubeIds: ["t-edta"], toolIds: ["o-hema", "o-microscope", "o-slides"],
      steps: [
        step("اقلب التيوب 8–10 مرات بلطف فور السحب."),
        step("افحص العينة بصرياً: لا تجلط ولا نقص في الحجم.", true),
        step("شغّل عينة السيطرة (QC) وتأكّد أنها ضمن الحدود."),
        step("امزج العينة مجدداً قبل التحليل مباشرة ثم حلّلها."),
        step("راجع الإنذارات (Flags) والرسوم البيانية."),
        step("عند وجود إنذار أو نتيجة غير طبيعية حضّر شريحة دموية وافحصها بالمجهر."),
      ],
      tips: [
        "وجود جلطة صغيرة يُنقص الصفائح زوراً — افحص العينة بعيدان خشبي عند الشك.",
        "التيوب الناقص يزيد تركيز EDTA فتنكمش الكريات ويقل الـ HCT.",
        "الأجسام الباردة (Cold agglutinins): MCHC عالٍ جداً و RBC منخفض — دفّئ العينة 37°م وأعد التحليل.",
      ],
      normals: [
        { label: "Hb ذكور", value: "13 – 17 g/dL" }, { label: "Hb إناث", value: "12 – 15 g/dL" },
        { label: "WBC", value: "4 – 11 ×10³/µL" }, { label: "PLT", value: "150 – 450 ×10³/µL" },
      ],
      high: "WBC: التهاب بكتيري ، لوكيميا. PLT: نزف ، التهاب ، نقص حديد.",
      low: "Hb: فقر الدم. WBC: عدوى فيروسية ، أدوية. PLT: عدوى فيروسية ، ITP ، جلطة في العينة.",
      resultNotes: "",
      links: [],
    },
    {
      ...base, id: "x-gue", name_ar: "فحص الإدرار العام", name_en: "General Urine Examination", abbr: "GUE", category: "الإدرار",
      purpose: "الكشف عن التهابات المجاري البولية وأمراض الكلى والسكري.",
      summary: "فحص فيزيائي (اللون ، الصفاء) + كيميائي بالشريط + مجهري للراسب.",
      sampleType: "إدرار", volume: "10–20 مل", patientPrep: "العينة الوسطى (Midstream) من أول إدرار صباحي، بعد تنظيف المنطقة.",
      storage: "يُفحص خلال ساعة إلى ساعتين. يمكن حفظه في الثلاجة حتى 24 ساعة.",
      tubeIds: ["t-urine"], toolIds: ["o-dipstick", "o-centrifuge", "o-slides", "o-microscope"],
      steps: [
        step("سجّل اللون والصفاء (Clear / Turbid)."),
        step("اغمس الشريط 1–2 ثانية، أزل الزيادة على ورق نشاف، واقرأ كل مربع في وقته المحدد."),
        step("ضع 10 مل في أنبوب واطرده 5 دقائق عند 1500–2000 دورة/دقيقة."),
        step("اسكب الرائق واترك حوالي 0.5 مل، ثم أعد تعليق الراسب بالنقر الخفيف."),
        step("ضع قطرة على شريحة وغطّها، وافحص بالعدسة 10x ثم 40x."),
        step("سجّل عدد RBC و WBC لكل حقل (HPF)، والخلايا الظهارية والأسطوانات والبلورات والبكتريا."),
      ],
      tips: [
        "الإدرار القديم: تتكاثر البكتريا، ويصبح قلوياً، وتذوب الأسطوانات — افحصه طازجاً.",
        "كثرة الخلايا الظهارية الحرشفية تعني تلوّث العينة — اطلب عينة وسطى نظيفة.",
        "لا تقرأ الشريط بعد وقته المحدد لأن الألوان تستمر بالتغيّر.",
      ],
      normals: [
        { label: "اللون", value: "أصفر فاتح ، صافٍ" }, { label: "pH", value: "4.5 – 8" }, { label: "SG", value: "1.005 – 1.030" },
        { label: "Glucose / Protein / Ketones", value: "Negative" }, { label: "RBC", value: "0 – 2 /HPF" }, { label: "WBC", value: "0 – 5 /HPF" },
      ],
      high: "Pus cells: التهاب. RBC: حصى ، التهاب ، دورة شهرية. Glucose: سكري. Protein: أمراض الكلى.",
      low: "",
      resultNotes: "بلورات أوكزالات الكالسيوم تشبه الظرف البريدي. بلورات حمض اليوريك صفراء بأشكال متعددة في الإدرار الحامضي.",
      links: [{ id: "x-fbs", note: "السكر في الإدرار يستوجب قياس سكر الدم." }],
    },
    {
      ...base, id: "x-alt", name_ar: "إنزيم ALT (GPT)", name_en: "Alanine Aminotransferase", abbr: "ALT", category: "وظائف الكبد",
      purpose: "الكشف عن تضرّر خلايا الكبد (الأكثر خصوصية للكبد).",
      summary: "طريقة حركية (Kinetic UV): يُقاس تناقص امتصاص NADH عند 340 نانومتر في الدقيقة، وهو يتناسب مع نشاط الإنزيم.",
      sampleType: "مصل", volume: "2–3 مل دم", patientPrep: "لا يحتاج صياماً. يُفضّل تجنّب الرياضة العنيفة قبله.",
      storage: "ثابت 3 أيام في الثلاجة.",
      tubeIds: ["t-gel", "t-plain"], toolIds: ["o-centrifuge", "o-micropipette", "o-altreagent", "o-spectro", "o-timer"],
      steps: [
        step("افصل المصل وتأكّد أنه غير متحلل.", true),
        step("اخلط الكاشف حسب النشرة وأوصله إلى 37°م."),
        step("أضف 100 µL مصل إلى 1000 µL كاشف وامزج."),
        step("بعد دقيقة اقرأ الامتصاص عند 340 نانومتر، ثم كل دقيقة لمدة 3 دقائق."),
        step("احسب متوسط التغيّر في الدقيقة (ΔA/min) واضربه بالمعامل (Factor) المذكور في النشرة."),
      ],
      tips: [
        "إذا كان التغيّر في الدقيقة أكبر من الحد في النشرة، خفّف العينة 1:10 بمحلول ملحي وأعد الفحص ثم اضرب بـ 10.",
        "التحلل يرفع النتيجة قليلاً (وأكثر بكثير في AST).",
      ],
      normals: [{ label: "ذكور", value: "حتى 41 U/L" }, { label: "إناث", value: "حتى 33 U/L" }],
      high: "التهاب الكبد الفيروسي ، الكبد الدهني ، الأدوية (باراسيتامول ، أدوية السل) ، انسداد القنوات الصفراوية.",
      low: "غالباً بلا أهمية سريرية.",
      resultNotes: "",
      links: [{ id: "x-ast", note: "يُفسَّران معاً — نسبة AST/ALT تساعد في التفريق بين أسباب تضرّر الكبد." }],
    },
    {
      ...base, id: "x-ast", name_ar: "إنزيم AST (GOT)", name_en: "Aspartate Aminotransferase", abbr: "AST", category: "وظائف الكبد",
      purpose: "تقييم تضرّر الكبد، ويوجد أيضاً في القلب والعضلات.",
      summary: "طريقة حركية (Kinetic UV) عند 340 نانومتر، مثل ALT.",
      sampleType: "مصل", volume: "2–3 مل دم", patientPrep: "لا يحتاج صياماً.",
      storage: "ثابت 3 أيام في الثلاجة.",
      tubeIds: ["t-gel", "t-plain"], toolIds: ["o-centrifuge", "o-micropipette", "o-altreagent", "o-spectro", "o-timer"],
      steps: [
        step("افصل المصل — العينة المتحللة مرفوضة لهذا الفحص.", true),
        step("اخلط الكاشف وأوصله إلى 37°م."),
        step("أضف 100 µL مصل إلى 1000 µL كاشف وامزج."),
        step("اقرأ الامتصاص عند 340 نانومتر كل دقيقة لمدة 3 دقائق."),
        step("احسب ΔA/min × المعامل."),
      ],
      tips: [
        "الكريات الحمر فيها AST بكمية كبيرة، لذلك أقل تحلل يرفع النتيجة بشكل واضح.",
        "نسبة AST/ALT أكبر من 2 توحي بضرر كبدي كحولي.",
      ],
      normals: [{ label: "بالغين", value: "حتى 40 U/L" }],
      high: "أمراض الكبد ، الجلطة القلبية ، إصابات العضلات ، الرياضة العنيفة ، تحلل العينة.",
      low: "غالباً بلا أهمية سريرية.",
      resultNotes: "",
      links: [{ id: "x-alt", note: "يُطلبان معاً ضمن وظائف الكبد." }],
    },
  ];
  return { tubes, tools, tests };
}
