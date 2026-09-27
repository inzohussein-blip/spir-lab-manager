/**
 * Structured report forms for tests that are not a single number:
 * General Urine Examination (GUE), General Stool Examination (GSE),
 * Seminal Fluid Analysis (SFA) and Culture & Sensitivity (CS).
 *
 * The form answers are stored in the test's normal result value as
 * "__tpl__:" + JSON, so saving, editing, reprinting and backups need no special handling.
 * Printed values are English; the Arabic next to an option is a hint for the staff only.
 */

import { kvGet, kvSet } from "@/lib/local/kv";

export type Opt = { v: string; ar?: string };
const o = (v: string, ar?: string): Opt => ({ v, ar });
const plain = (...vs: string[]): Opt[] => vs.map((v) => ({ v }));

export interface TField {
  k: string;
  label: string;
  /** Reference / normal value column (macroscopic sections). */
  ref?: string;
  /** Unit / field column (microscopic sections). */
  unit?: string;
  opts?: Opt[];
  /** Value used by «ملء القيم الطبيعية». */
  normal?: string;
  /** Other answers that also count as normal (for «bold abnormal» on the printed report). */
  ok?: string[];
  /** Descriptive field — never marked abnormal. */
  noFlag?: boolean;
  indent?: boolean;
}
export type TRow = TField | { sub: string };
export interface TSection { title: string; col: "Reference Range" | "Unit / Field" | "Normal Values"; rows: TRow[] }
export interface Template { code: string; title: string; sections: TSection[] }

export const isSub = (r: TRow): r is { sub: string } => "sub" in r;

// ── Shared option lists ──────────────────────────────────────────────────────
/** Amount scale — printed exactly as chosen: Nil, Few, +, ++, +++, ++++, More than (++++). */
const AMOUNT = [o("Nil", "لا يوجد"), o("Few", "قليل"), o("+", "بسيط"), o("++", "متوسط"), o("+++", "كثير"), o("++++", "كثير جداً"), o("More than (++++)", "مملوء")];
const CHEM = plain("Nil", "Trace", "+", "++", "+++", "++++");
const PERCENT = Array.from({ length: 21 }, (_, i) => ({ v: `${i * 5}%` }));

// ── General Urine Examination ────────────────────────────────────────────────
const HPF_U = [...plain("0 - 1", "1 - 2", "2 - 3", "2 - 4", "3 - 5", "5 - 10", "10 - 15", "15 - 20", "20 - 30", "30 - 50"), o("Over 100 / Plenty / Loaded", "مملوء")];
export const GUE: Template = {
  code: "GUE",
  title: "GENERAL URINE EXAMINATION (G.U.E)",
  sections: [
    {
      title: "1. Physical & Chemical Examination (Macroscopic)", col: "Reference Range",
      rows: [
        { k: "color", label: "Color", ref: "Yellow / Straw", normal: "Yellow", ok: ["Pale Yellow", "Straw"],
          opts: [o("Yellow", "أصفر طبيعي"), o("Pale Yellow", "أصفر باهت"), o("Dark Yellow", "أصفر داكن"), o("Amber", "كهرماني"), o("Orange", "برتقالي"), o("Red / Bloody", "دموي"), o("Greenish / Brownish", "مخضر / بني")] },
        { k: "appearance", label: "Appearance", ref: "Clear", normal: "Clear",
          opts: [o("Clear", "رائق"), o("Slightly Cloudy / Semi-Turbid", "شبه عكر"), o("Cloudy / Turbid", "عكر")] },
        { k: "ph", label: "Reaction (pH)", ref: "4.6 – 8.0", normal: "Acidic (6.0)",
          opts: plain("Acidic (5.0)", "Acidic (5.5)", "Acidic (6.0)", "Acidic (6.5)", "Neutral (7.0)", "Alkaline (7.5)", "Alkaline (8.0)") },
        { k: "sg", label: "Specific Gravity", ref: "1.005 – 1.030", normal: "1.020", opts: plain("1.005", "1.010", "1.015", "1.020", "1.025", "1.030") },
        { k: "albumin", label: "Albumin (Protein)", ref: "Nil", normal: "Nil", opts: CHEM },
        { k: "sugar", label: "Sugar (Glucose)", ref: "Nil", normal: "Nil", opts: CHEM },
        { k: "ketone", label: "Ketone Bodies", ref: "Nil", normal: "Nil", opts: CHEM },
        { k: "bile", label: "Bile Pigment (Bilirubin)", ref: "Nil", normal: "Nil", opts: CHEM },
        { k: "urobil", label: "Urobilinogen", ref: "Normal", normal: "Normal", opts: plain("Normal", "Increased (+)", "Increased (++)", "Increased (+++)") },
        { k: "nitrite", label: "Nitrite", ref: "Negative", normal: "Negative", opts: plain("Negative", "Positive") },
      ],
    },
    {
      title: "2. Microscopic Examination", col: "Unit / Field",
      rows: [
        { k: "pus", label: "Pus Cells (WBCs)", unit: "/ H.P.F", normal: "0 - 1", ok: ["1 - 2", "2 - 3", "2 - 4", "3 - 5"], opts: HPF_U },
        { k: "rbc", label: "R.B.Cs (Red Blood Cells)", unit: "/ H.P.F", normal: "0 - 1", ok: ["1 - 2", "2 - 3"], opts: HPF_U },
        { k: "epi", label: "Epithelial Cells", unit: "/ H.P.F", normal: "Few", ok: ["Nil", "+"], opts: AMOUNT },
        { k: "casts", label: "Casts (Hyaline / Granular / Others)", unit: "/ L.P.F", normal: "Nil",
          opts: [o("Nil"), o("Hyaline Casts (Few)"), o("Hyaline Casts (Many)"), o("Granular Casts (Few)"), o("Granular Casts (Many)"), o("WBC Casts"), o("RBC Casts")] },
        { sub: "CRYSTALS & AMORPHOUS DEPOSITS" },
        { k: "amorph", label: "Amorphous (Urates / Phosphates)", unit: "/ H.P.F", normal: "Nil",
          opts: plain("Nil", "Amorphous Urates (Few)", "Amorphous Urates (Many)", "Amorphous Phosphates (Few)", "Amorphous Phosphates (Many)") },
        { k: "uric", label: "Uric Acid Crystals", unit: "/ H.P.F", normal: "Nil", opts: AMOUNT },
        { k: "caox", label: "Calcium Oxalate / Phosphate", unit: "/ H.P.F", normal: "Nil",
          opts: plain("Nil", "Calcium Oxalate (Few)", "Calcium Oxalate (Many)", "Calcium Phosphate (Few)", "Calcium Phosphate (Many)") },
        { sub: "MICROORGANISMS & OTHER FINDINGS" },
        { k: "mucus", label: "Mucus Threads", unit: "/ H.P.F", normal: "Nil", opts: AMOUNT },
        { k: "bacteria", label: "Bacteria", unit: "/ H.P.F", normal: "Nil", opts: AMOUNT },
        { k: "yeast", label: "Yeast Cells", unit: "/ H.P.F", normal: "Nil", opts: AMOUNT },
        { k: "others", label: "Others / Remarks (e.g. Sperms, Trichomonas)", unit: "/ H.P.F", normal: "Nil",
          opts: plain("Nil", "Sperms", "Trichomonas vaginalis") },
      ],
    },
  ],
};

// ── General Stool Examination ────────────────────────────────────────────────
const HPF_S = [...plain("Nil", "0 - 1", "1 - 2", "2 - 5", "5 - 10", "10 - 15", "15 - 20", "20 - 30", "30 - 50"), o("Loaded / Plenty", "مملوء")];
const PARASITES = [o("Nil", "لا يوجد"), o("Entamoeba histolytica (Cyst)"), o("Entamoeba histolytica (Trophozoite)"), o("Giardia lamblia (Cyst)"), o("Giardia lamblia (Trophozoite)"), o("Entamoeba coli (Cyst)"), o("Blastocystis hominis"), o("Cryptosporidium spp.")];
const HELMINTHS = [o("Nil", "لا يوجد"), o("Ascaris lumbricoides Ova"), o("Enterobius vermicularis (Pinworm Ova)"), o("Hymenolepis nana Ova"), o("Ancylostoma duodenale Ova"), o("Taenia spp. Ova")];
export const GSE: Template = {
  code: "GSE",
  title: "GENERAL STOOL EXAMINATION (G.S.E)",
  sections: [
    {
      title: "1. Physical & Chemical Examination (Macroscopic)", col: "Reference Range",
      rows: [
        { k: "color", label: "Color", ref: "Brown", normal: "Brown", ok: ["Dark Brown", "Light Brown"],
          opts: [o("Brown", "بني طبيعي"), o("Dark Brown", "بني داكن"), o("Light Brown", "بني فاتح"), o("Yellowish", "مصفر"), o("Greenish", "مخضر"), o("Black / Tarry (Melena)", "أسود / قطراني"), o("Reddish / Bloody", "مدمى / أحمر"), o("Clay-colored / Pale", "شاحب / طيني")] },
        { k: "consistency", label: "Consistency", ref: "Formed / Soft", normal: "Formed", ok: ["Semi-Formed", "Soft"],
          opts: [o("Formed", "متماسك / طبيعي"), o("Semi-Formed", "شبه متماسك"), o("Soft", "لين"), o("Loose", "مفكك"), o("Watery / Diarrheal", "مائي / إسهال"), o("Hard", "صلب")] },
        { k: "ph", label: "Reaction (pH)", ref: "Neutral / Slightly Acidic", normal: "Neutral (7.0)", ok: ["Slightly Acidic", "Slightly Alkaline"],
          opts: plain("Acidic", "Slightly Acidic", "Neutral (7.0)", "Slightly Alkaline", "Alkaline") },
        { k: "blood", label: "Blood (Macroscopic)", ref: "Nil", normal: "Nil", opts: AMOUNT },
        { k: "mucus", label: "Mucus", ref: "Nil", normal: "Nil", opts: AMOUNT },
        { k: "worms", label: "Helminths / Worms", ref: "Nil", normal: "Nil", opts: HELMINTHS },
      ],
    },
    {
      title: "2. Microscopic Examination", col: "Unit / Field",
      rows: [
        { k: "pus", label: "Pus Cells (WBCs)", unit: "/ H.P.F", normal: "0 - 1", ok: ["Nil", "1 - 2"], opts: HPF_S },
        { k: "rbc", label: "R.B.Cs (Red Blood Cells)", unit: "/ H.P.F", normal: "Nil", opts: HPF_S },
        { sub: "PARASITES & OVA" },
        { k: "ova", label: "Ova (Eggs)", unit: "/ H.P.F", normal: "Nil", opts: HELMINTHS },
        { k: "larva", label: "Larva", unit: "/ H.P.F", normal: "Nil", opts: [o("Nil", "لا يوجد"), o("Present", "موجود")] },
        { k: "cyst", label: "Cyst (e.g. E. histolytica / E. coli / Giardia)", unit: "/ H.P.F", normal: "Nil", opts: PARASITES },
        { k: "tropho", label: "Trophozoite (Active Stage)", unit: "/ H.P.F", normal: "Nil", opts: PARASITES },
        { sub: "FUNGI & DIGESTION FINDINGS" },
        { k: "yeast", label: "Monilia / Yeast Cells", unit: "/ H.P.F", normal: "Nil", opts: AMOUNT },
        { k: "food", label: "Undigested Food Particles", unit: "/ H.P.F", normal: "Few", ok: ["Nil", "+"], opts: AMOUNT },
        { k: "fat", label: "Fat Globules / Starch Granules", unit: "/ H.P.F", normal: "Nil", opts: AMOUNT },
        { k: "others", label: "Others / Remarks", unit: "/ H.P.F", normal: "Nil", opts: plain("Nil") },
      ],
    },
  ],
};

// ── Seminal Fluid Analysis ───────────────────────────────────────────────────
const HPF_SF = [...plain("0 - 1", "1 - 2", "2 - 5", "5 - 10", "10 - 20"), o("Loaded / Over 100 (Leukocytospermia)", "مملوء")];
export const SFA: Template = {
  code: "SFA",
  title: "SEMINAL FLUID ANALYSIS REPORT",
  sections: [
    {
      title: "Macroscopical Examination", col: "Normal Values",
      rows: [
        { k: "abstinence", label: "Abstinence Period", ref: "3 – 5 days", normal: "3 days", noFlag: true, opts: plain("1 day", "2 days", "3 days", "4 days", "5 days", "6 days", "7 days", "> 7 days") },
        { k: "volume", label: "Volume", ref: "≥ 1.5 ml", normal: "3.0 ml", opts: ["0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0"].map((v) => ({ v: `${v} ml` })) },
        { k: "viscosity", label: "Viscosity", ref: "Drops ≤ 2 cm thread", normal: "Normal",
          opts: [o("Normal", "طبيعي"), o("Viscid / High Viscosity", "عالي اللزوجة"), o("Liquid / Low Viscosity", "سائل / منخفض اللزوجة")] },
        { k: "liquefaction", label: "Liquefaction Time", ref: "Within 30 – 60 minutes", normal: "Within 30 - 60 Minutes", ok: ["Within 15 - 30 Minutes"],
          opts: [o("Within 15 - 30 Minutes", "طبيعي"), o("Within 30 - 60 Minutes", "طبيعي"), o("Delayed (> 60 Minutes)", "متأخر")] },
        { k: "appearance", label: "Appearance", ref: "Homogenous / Opalescent grey", normal: "Homogenous / Opalescent grey", ok: ["Grey-White / Normal"],
          opts: [o("Homogenous / Opalescent grey", "طبيعي"), o("Grey-White / Normal", "رمادي أبيض"), o("Milky White", "أبيض حليبي"), o("Yellowish", "مصفر"), o("Brownish / Reddish (Hematospermia)", "بني / مدمى")] },
        { k: "ph", label: "Acidity (pH)", ref: "Alkaline (≥ 7.2)", normal: "7.8", opts: plain("7.0", "7.2", "7.4", "7.6", "7.8", "8.0", "8.2", "8.5") },
      ],
    },
    {
      title: "Microscopical Examination", col: "Normal Values",
      rows: [
        { k: "conc", label: "Sperm Concentration", ref: "≥ 15 millions/ml", normal: "60 millions/ml",
          opts: [o("Nil (Azoospermia)", "لا توجد نطف"), ...["< 1", "5", "10", "15", "20", "30", "40", "60", "80", "100", "> 120"].map((v) => ({ v: `${v} millions/ml` })), o("Oligozoospermia", "قلة النطف")] },
        { k: "total", label: "Total Sperm Count", ref: "≥ 39 millions/ejaculate", normal: "180 millions/ejaculate" },
        { sub: "Sperm Motility Percent:" },
        { k: "pr", label: "Progressive Motile (Active)", ref: "Progressive motile sperms ≥ 40% ; within 60 minutes.", indent: true, normal: "50%", opts: PERCENT },
        { k: "np", label: "Non-Progressive Motile (Sluggish)", indent: true, normal: "10%", noFlag: true, opts: PERCENT },
        { k: "im", label: "Immotile", indent: true, normal: "40%", noFlag: true, opts: PERCENT },
        { k: "tm", label: "Total Motility (PR + NP)", ref: "≥ 40%", indent: true, normal: "60%", opts: PERCENT },
        { sub: "Sperm Morphology Percent:" },
        { k: "normalf", label: "Normal", ref: "> 30%", indent: true, normal: "40%", opts: PERCENT },
        { k: "abnormalf", label: "Abnormal", ref: "< 70%", indent: true, normal: "60%", opts: PERCENT },
        { k: "defects", label: "Abnormal Forms Type", indent: true, normal: "Mixed (Head / Neck / Tail)", noFlag: true,
          opts: [o("Head Defects", "تشوهات الرأس"), o("Neck / Midpiece Defects", "تشوهات العنق"), o("Tail Defects", "تشوهات الذيل"), o("Mixed (Head / Neck / Tail)", "مختلطة")] },
        { k: "vitality", label: "Vitality (Live Sperms)", ref: "≥ 58%", normal: "70%", opts: PERCENT },
        { k: "aggregation", label: "Sperm Aggregation", ref: "-ve", normal: "-ve", opts: plain("-ve", "+", "++", "+++") },
        { k: "agglutination", label: "Sperm Agglutination", ref: "< 10 Sperm/agglutinate", normal: "Nil",
          opts: AMOUNT },
        { k: "wbc", label: "Leucocytes (Pus cells)", ref: "< 1 / HPF", normal: "0 - 1", ok: ["1 - 2"], opts: HPF_SF },
        { k: "rbc", label: "R.B.Cs", ref: "Nil", normal: "Nil", opts: [o("Nil"), ...HPF_SF] },
        { k: "othercells", label: "Others Cells (Spermatogenic)", ref: "Nil", normal: "Nil",
          opts: AMOUNT },
        { k: "fructose", label: "Fructose Test", ref: "Positive (+ve)", normal: "Positive (+ve)", opts: plain("Positive (+ve)", "Negative (-ve)") },
      ],
    },
  ],
};

// ── Culture & Sensitivity ────────────────────────────────────────────────────
export const CS_SPECIMENS: Opt[] = [
  o("Urine", "مزرعة بول"), o("Stool", "مزرعة خروج"), o("Blood", "مزرعة دم"), o("Sputum", "مزرعة بلغم"),
  o("Wound / Pus Swab", "مسحة جرح / صديد"), o("Throat / Nasal Swab", "مسحة حلق / أنف"), o("High Vaginal Swab (HVS)", "مسحة مهبلية"),
  o("Seminal Fluid", "مزرعة سائل منوي"), o("CSF / Body Fluids", "سائل النخاع / سوائل الجسم"),
];
export const CS_GROWTH: Opt[] = [
  o("No growth of pathogenic bacteria after 24-48 hours", "لا يوجد نمو"),
  o("Significant bacterial growth", "نمو بكتيري مهم سريرياً"),
  o("Non-pathogenic normal flora", "فلورا طبيعية"),
  o("Contaminated sample — re-sample required", "عينة ملوثة / يُعاد الفحص"),
];
export const CS_ORGANISMS: { group: string; items: string[] }[] = [
  { group: "Gram-Negative Bacteria", items: ["Escherichia coli (E. coli)", "Klebsiella spp.", "Klebsiella pneumoniae", "Pseudomonas aeruginosa", "Proteus mirabilis", "Proteus vulgaris", "Enterobacter species", "Salmonella spp.", "Shigella spp."] },
  { group: "Gram-Positive Bacteria", items: ["Staphylococcus aureus", "Methicillin-Resistant Staphylococcus aureus (MRSA)", "Enterococcus faecalis", "Streptococcus pneumoniae", "Streptococcus pyogenes"] },
  { group: "Fungi & Yeasts", items: ["Candida albicans", "Candida non-albicans spp."] },
];
export const CS_COLONY: Opt[] = [
  o("< 10⁴ CFU/mL", "غير دال سريرياً"), o("10⁴ - 10⁵ CFU/mL", "نمو متوسط / مشكوك فيه"), o("> 10⁵ CFU/mL", "نمو مؤكد وشديد"),
];
/** Antibiotics in the order of the lab's paper report (printed in two columns: first half left, second half right). */
export const CS_ANTIBIOTICS: { group: string; items: string[] }[] = [
  { group: "Types of antibiotics", items: [
    "Amoxiclave", "Amikacin", "Meropenem", "Aztreonam", "Cefotaxime", "Ceftriaxone", "Ciprofloxacin", "Cefoxitin", "Cefixime", "Ceftazidime",
    "Cefpodoxime", "Cefuroxime", "Cefepime", "Cephalexin", "Azithromycin", "Amoxicillin", "Piperacillin", "Penicillin G", "Tetracycline",
    "Tobramycin", "Trimethoprim", "Nitrofurantoin", "Nalidixic acid", "Norfloxacin", "Imipenem", "Gentamicin", "Ofloxacin", "Levofloxacin",
    "Lincomycin", "Rifampin", "Moxifloxacin", "Metronidazole", "Clarithromycin", "Clindamycin", "Oxacillin", "Erythromycin", "Vancomycin", "Streptomycin",
  ] },
];
/** Sensitivity scale, stored as printed. Older saves used S / I / R. */
export const AST_SCALE = [
  { v: "H.S", name: "High sensitive", ar: "حساس جداً" },
  { v: "M.S", name: "Moderate sensitive", ar: "حساس متوسط" },
  { v: "R", name: "Resistant", ar: "مقاوم" },
] as const;
export const astValue = (v?: string) => (v === "S" ? "H.S" : v === "I" ? "M.S" : v ?? "");
export const isGrowth = (g?: string) => (g ?? "").toLowerCase().startsWith("significant");
/** Growth to report: "significant growth" chosen, or an organism entered on a culture that is not "no growth" / flora / contaminated. */
export const cultureGrowth = (v: FormValues) =>
  isGrowth(v.growth) || (!!v.organism?.trim() && !/^(no growth|non-pathogenic|contaminated)/i.test(v.growth ?? ""));

// ── Registry + value encoding ────────────────────────────────────────────────
export const TEMPLATES: Record<string, Template> = { GUE, GSE, SFA };
/** Test codes that use a structured form (CS has its own form and print layout). */
export const FORM_CODES = ["GUE", "GSE", "SFA", "CS"] as const;
export type FormCode = (typeof FORM_CODES)[number];
export type TplCode = Exclude<FormCode, "CS">;
export const isFormCode = (code?: string): code is FormCode => !!code && (FORM_CODES as readonly string[]).includes(code);

export type Group = { group: string; items: string[] };
export interface CultureLists { title: string; specimens: Opt[]; organisms: Group[]; colony: Opt[]; antibiotics: Group[] }
export const CS_DEFAULT: CultureLists = {
  title: "CULTURE AND SENSITIVITY REPORT", specimens: CS_SPECIMENS, organisms: CS_ORGANISMS, colony: CS_COLONY, antibiotics: CS_ANTIBIOTICS,
};

// ── Lab's own edits of the forms (Tests management → «تعديل الاستمارة») ───────
const K_FORMS = "station.formTemplates.v1";
type Custom = Partial<Record<TplCode, Template>> & { CS?: CultureLists };
let cache: { raw: string | null; data: Custom } | null = null;
function customs(): Custom {
  if (typeof window === "undefined") return {};
  try {
    const raw = kvGet(K_FORMS);
    if (cache && cache.raw === raw) return cache.data;
    const data = raw ? (JSON.parse(raw) as Custom) : {};
    cache = { raw, data };
    return data;
  } catch { return {}; }
}
/** The form in use: the lab's edited copy if any, otherwise the built-in one. */
export function templateOf(code: TplCode): Template {
  const t = customs()[code];
  return t && Array.isArray(t.sections) ? t : TEMPLATES[code];
}
/** The first built-in antibiotic list (before the lab's paper list); a saved copy of it is upgraded. */
const OLD_AST = "Amoxicillin/Clavulanate,Ampicillin/Sulbactam,Piperacillin/Tazobactam,Ceftriaxone,Cefotaxime,Ceftazidime,Cefepime,Cefixime,Ciprofloxacin,Levofloxacin,Ofloxacin,Meropenem,Imipenem,Amikacin,Gentamicin,Vancomycin,Nitrofurantoin,Trimethoprim/Sulfamethoxazole,Linezolid";
export function cultureOf(): CultureLists {
  const c = customs().CS;
  if (!c || !Array.isArray(c.antibiotics)) return CS_DEFAULT;
  const oldList = c.antibiotics.flatMap((g) => g.items).join(",") === OLD_AST;
  return { ...CS_DEFAULT, ...c, ...(oldList ? { antibiotics: CS_DEFAULT.antibiotics } : {}) };
}
export const isCustomForm = (code: FormCode) => !!customs()[code];
/** Save an edited form, or null to go back to the built-in one. */
export function saveCustomForm(code: FormCode, value: Template | CultureLists | null): boolean {
  try {
    const next: Custom = { ...customs() };
    if (value) (next as Record<string, unknown>)[code] = value; else delete next[code];
    return kvSet(K_FORMS, JSON.stringify(next));
  } catch { return false; }
}
export const formTitle = (code: FormCode) => (code === "CS" ? cultureOf().title : templateOf(code).title);

/** Older saved answers used worded amounts; print them in the current short scale. */
const LEGACY: Record<string, string> = {
  "A Few (+)": "Few", "Moderate (++)": "++", "Many (+++)": "+++", "Plenty / Loaded (++++)": "++++", "Plenty (++++)": "++++",
  "Present (+)": "+", "Abundant (+++)": "+++", "Severe / Present (+++)": "+++",
};
export const printValue = (v?: string) => (v ? LEGACY[v] ?? v : "");

const PREFIX = "__tpl__:";
export type FormValues = Record<string, string>;
export const isFormValue = (v?: string) => !!v && v.startsWith(PREFIX);
export function decodeForm(v?: string): FormValues {
  if (!isFormValue(v)) return {};
  try { return JSON.parse(v!.slice(PREFIX.length)) as FormValues; } catch { return {}; }
}
/** Empty when nothing is filled (so the test counts as "no result yet"). */
export function encodeForm(values: FormValues): string {
  const clean = Object.fromEntries(Object.entries(values).filter(([, x]) => x != null && String(x).trim() !== ""));
  return Object.keys(clean).length ? PREFIX + JSON.stringify(clean) : "";
}

/** Fields of a template (subheaders excluded). */
export const fieldsOf = (t: Template): TField[] => t.sections.flatMap((s) => s.rows.filter((r): r is TField => !isSub(r)));

/** Number of filled answers / total, for the entry-screen badge. */
export function formProgress(code: FormCode, values: FormValues): { filled: number; total: number } {
  if (code === "CS") {
    const need = ["specimen", cultureGrowth(values) ? "organism" : "growth"];
    return { filled: need.filter((k) => (values[k] ?? "").trim()).length, total: need.length };
  }
  const f = fieldsOf(templateOf(code));
  return { filled: f.filter((x) => (values[x.k] ?? "").trim()).length, total: f.length };
}

/** One-line text version (CSV export). */
export function formSummary(code: FormCode, values: FormValues): string {
  if (code === "CS") {
    const ab = (p: string) => Object.entries(values).filter(([k, v]) => k.startsWith(p) && v).map(([k, v]) => `${k.slice(p.length)}=${astValue(v)}`).join(", ");
    return [values.specimen, values.growth, values.organism, values.colony, ab("ab:"), values.organism2, values.colony2, ab("ab2:"), values.notes].filter(Boolean).join(" | ");
  }
  return [...fieldsOf(templateOf(code)).filter((f) => values[f.k]).map((f) => `${f.label}: ${printValue(values[f.k])}`), values.notes && `Remarks: ${values.notes}`]
    .filter(Boolean).join("; ");
}

/** Motility total (PR + NP) and total count (concentration × volume), when both parts are numbers. */
export function sfaComputed(v: FormValues): { tm?: string; total?: string } {
  const num = (s?: string) => { const m = /^\s*(\d+(?:\.\d+)?)/.exec(s ?? ""); return m ? Number(m[1]) : null; };
  const pr = num(v.pr), np = num(v.np), conc = num(v.conc), vol = num(v.volume);
  return {
    tm: pr != null && np != null ? `${Math.min(100, pr + np)}%` : undefined,
    total: conc != null && vol != null && !/^</.test(v.conc ?? "") ? `${+(conc * vol).toFixed(1)} millions/ejaculate` : undefined,
  };
}

/** Readable text for any saved result value: forms become a short summary. */
export function valueText(value: string | undefined, code?: string, short = false): string {
  if (!isFormValue(value)) return value ?? "";
  if (!isFormCode(code)) return "";
  const v = decodeForm(value);
  if (short) { const p = formProgress(code, v); return `استمارة (${p.filled}/${p.total})`; }
  return formSummary(code, v);
}

// ── Options from the station settings (each can be switched off / on) ────────
export interface FormOptions { diagnosis: boolean; autoCalc: boolean; hideEmpty: boolean; testedOnly: boolean; boldAbnormal: boolean }
export function formOptionsOf(st: {
  sfaDiagnosis?: boolean; sfaAutoCalc?: boolean; formHideEmpty?: boolean; csTestedOnly?: boolean; formBoldAbnormal?: boolean;
}): FormOptions {
  return {
    diagnosis: st.sfaDiagnosis !== false, autoCalc: st.sfaAutoCalc !== false,
    hideEmpty: st.formHideEmpty === true, testedOnly: st.csTestedOnly === true, boldAbnormal: st.formBoldAbnormal !== false,
  };
}

const firstNum = (s?: string) => { const m = /(\d+(?:\.\d+)?)/.exec(s ?? ""); return m ? Number(m[1]) : null; };
const numOf = (s?: string) => { const m = /^\s*[<>]?\s*(\d+(?:\.\d+)?)/.exec(s ?? ""); return m ? Number(m[1]) : null; };

/** Is a printed answer outside normal? Numbers are checked against the printed reference (≥ x, > x, < x, a – b), words against the normal answer. */
export function isAbnormal(f: TField, raw?: string): boolean {
  const v = printValue(raw).trim();
  if (!v || f.noFlag) return false;
  const norm = (x: string) => x.trim().toLowerCase();
  if ((f.normal && norm(v) === norm(f.normal)) || f.ok?.some((x) => norm(x) === norm(v))) return false;
  const ref = f.ref ?? "";
  const n = (/^\s*[<>]/.test(v) ? numOf(v) : firstNum(v));
  const one = (v.match(/\d+(?:\.\d+)?/g) ?? []).length === 1;
  if (n != null && one) {
    let m: RegExpExecArray | null;
    if ((m = /(≥|>=|>|≤|<=|<)\s*(\d+(?:\.\d+)?)/.exec(ref))) {
      const t = Number(m[2]);
      return m[1] === "≥" || m[1] === ">=" ? n < t : m[1] === ">" ? n <= t : m[1] === "≤" || m[1] === "<=" ? n > t : n >= t;
    }
    if ((m = /(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/.exec(ref))) return n < Number(m[1]) || n > Number(m[2]);
  }
  return !!f.normal;
}

/** WHO-style conclusion for a semen analysis, from the printed references. Empty when there is not enough to judge. */
export function sfaDiagnosis(v: FormValues): string {
  const conc = v.conc ?? "";
  if (/^nil|azoo/i.test(conc) || numOf(conc) === 0) return "Azoospermia";
  const c = numOf(conc), vol = numOf(v.volume), total = numOf(v.total);
  const pr = numOf(v.pr), tm = numOf(v.tm), nf = numOf(v.normalf), af = numOf(v.abnormalf), vit = numOf(v.vitality);
  if (c == null) return "";
  const oligo = c < 15 || /^</.test(conc) || (total != null && total < 39);
  const astheno = (pr != null && pr < 40) || (tm != null && tm < 40);
  const terato = nf != null ? nf <= 30 : af != null ? af >= 70 : false;
  const parts = [oligo && "oligo", astheno && "astheno", terato && "terato"].filter(Boolean) as string[];
  const main = parts.length ? parts.join("") + "zoospermia" : "Normozoospermia";
  const out = [main.charAt(0).toUpperCase() + main.slice(1)];
  if (vol != null && vol < 1.5) out.push("Hypospermia");
  if (vit != null && vit < 58) out.push("Necrozoospermia");
  return out.join(", ");
}

/** Values that follow from the one just typed (semen auto-calculation). */
export function sfaAuto(v: FormValues, changed: string): FormValues {
  const out: FormValues = {};
  const pct = (x: number) => `${Math.max(0, Math.min(100, Math.round(x)))}%`;
  if (changed === "pr" || changed === "np") {
    const pr = numOf(v.pr), np = numOf(v.np);
    if (pr != null && np != null) { out.tm = pct(pr + np); out.im = pct(100 - pr - np); }
  }
  if (changed === "normalf") { const n = numOf(v.normalf); if (n != null) out.abnormalf = pct(100 - n); }
  if (changed === "abnormalf") { const n = numOf(v.abnormalf); if (n != null) out.normalf = pct(100 - n); }
  if (changed === "conc" || changed === "volume") { const t = sfaComputed(v).total; if (t) out.total = t; }
  return out;
}
