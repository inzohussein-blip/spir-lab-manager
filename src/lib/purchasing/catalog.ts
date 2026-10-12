/**
 * The devices and materials each test of the lab's built-in list needs (lib/station/defaultTests),
 * offered in «الأصناف ← مواد وأجهزة الفحوصات» and as suggestions on a purchase line. A material names
 * its device and the tests (by code) that use it: one unit per linked test ordered (lib/station/store
 * stockUse). A reagent shared by one run of several tests (the blood count, the electrolytes) is
 * linked to one of them only, so a run uses one unit. `byHand`: used by the day or by the
 * examiner (cleaners, wash buffers, slides), never with the results. Calculated tests (BUN, eGFR,
 * indirect bilirubin, globulin, LDL, VLDL, HOMA-IR) need no material of their own.
 */

export interface CatalogMaterial { name: string; device: string; codes: string[]; byHand?: boolean }

const CBC = "محلل أمراض الدم (CBC)";
const CHEM = "محلل الكيمياء الحيوية";
const ISE = "محلل الأملاح (ISE)";
const IMMUNO = "محلل المناعة والهرمونات (CLIA / FIA)";
const A1C = "جهاز السكر التراكمي (HbA1c)";
const ELISA = "قارئ وغاسل ELISA";
const RAPID = "الفحوص السريعة (كاسيت)";
const LATEX = "شريحة التلازن والهزّاز";
const MICRO = "المجهر";
const CULTURE = "الحاضنة (Incubator)";
const CENTRIFUGE = "جهاز الطرد المركزي";

/** The lab's devices, in the order shown. */
export const LAB_DEVICES = [CBC, CHEM, ISE, IMMUNO, A1C, ELISA, RAPID, LATEX, MICRO, CULTURE, CENTRIFUGE];

const kit = (device: string, prefix: string) => (code: string, label: string): CatalogMaterial => ({ name: `${prefix} ${label}`, device, codes: [code] });
const chem = kit(CHEM, "كاشف");
const immuno = kit(IMMUNO, "كاشف");
const elisa = kit(ELISA, "كت ELISA");
const cassette = kit(RAPID, "كاسيت");

export const LAB_MATERIALS: CatalogMaterial[] = [
  // ── Blood count: one run gives Hb, HCT, WBC and PLT — its reagents go with Hb ──
  { name: "محلول التخفيف (Diluent) — CBC", device: CBC, codes: ["HB"] },
  { name: "محلول التحليل (Lyse) — CBC", device: CBC, codes: ["HB"] },
  { name: "محلول التنظيف (Cleaner) — CBC", device: CBC, codes: [], byHand: true },
  { name: "سيطرة أمراض الدم (CBC Control)", device: CBC, codes: [], byHand: true },

  // ── Clinical chemistry: a kit per test ──
  chem("UREA", "اليوريا (Urea)"),
  chem("CREA", "الكرياتينين (Creatinine)"),
  chem("UA", "حمض اليوريك (Uric Acid)"),
  chem("ALT", "ALT (GPT)"),
  chem("AST", "AST (GOT)"),
  chem("ALP", "الفوسفاتيز القلوي (ALP)"),
  chem("TSB", "البيليروبين الكلي (Total Bilirubin)"),
  chem("DBIL", "البيليروبين المباشر (Direct Bilirubin)"),
  chem("GGT", "GGT"),
  chem("TP", "البروتين الكلي (Total Protein)"),
  chem("ALB", "الألبومين (Albumin)"),
  { name: "كاشف السكر (Glucose)", device: CHEM, codes: ["FBS", "RBS", "PPG2", "GTT"] },
  chem("CHOL", "الكوليسترول (Cholesterol)"),
  chem("TG", "الدهون الثلاثية (Triglycerides)"),
  chem("HDL", "HDL"),
  chem("CA", "الكالسيوم (Calcium)"),
  chem("PHOS", "الفسفور (Phosphorus)"),
  chem("MG", "المغنيسيوم (Magnesium)"),
  chem("FE", "الحديد (Serum Iron)"),
  chem("TIBC", "سعة ربط الحديد (TIBC)"),
  chem("ZN", "الزنك (Zinc)"),
  { name: "محلول المعايرة (Calibrator) — الكيمياء", device: CHEM, codes: [], byHand: true },
  { name: "سيطرة الكيمياء (Chemistry Control)", device: CHEM, codes: [], byHand: true },
  { name: "ماء مقطّر / منظّف المحلل", device: CHEM, codes: [], byHand: true },

  // ── Electrolytes: one run gives Na, K and Cl — the pack goes with Na (and ionized Ca) ──
  { name: "عبوة كواشف محلل الأملاح (ISE Reagent Pack)", device: ISE, codes: ["NA", "ICA"] },
  { name: "محلول تنظيف أقطاب ISE", device: ISE, codes: [], byHand: true },

  // ── Hormones, vitamins and markers on the immunoassay analyser ──
  immuno("TSH", "TSH"),
  immuno("TT3", "T3 الكلي (Total T3)"),
  immuno("TT4", "T4 الكلي (Total T4)"),
  immuno("FT3", "FT3"),
  immuno("FT4", "FT4"),
  immuno("FSH", "FSH"),
  immuno("LH", "LH"),
  immuno("PRL", "الحليب (Prolactin)"),
  immuno("TESTO", "التستوستيرون (Testosterone)"),
  immuno("FTESTO", "التستوستيرون الحر (Free Testosterone)"),
  immuno("BHCG", "هرمون الحمل الكمي (β-HCG)"),
  immuno("AMH", "AMH"),
  immuno("PROG", "البروجستيرون (Progesterone)"),
  immuno("E2", "الإستراديول (E2)"),
  immuno("CORT", "الكورتيزول (Cortisol)"),
  immuno("INS", "الأنسولين (Insulin)"),
  immuno("VITD", "فيتامين D (25-OH)"),
  immuno("B12", "فيتامين B12"),
  immuno("FERR", "الفيريتين (Ferritin)"),
  immuno("FOL", "حمض الفوليك (Folate)"),
  immuno("PTH", "هرمون الجار درقية (PTH)"),
  { name: "محلول الغسل / المادة الأولية — المناعة", device: IMMUNO, codes: [], byHand: true },
  { name: "سيطرة المناعة والهرمونات", device: IMMUNO, codes: [], byHand: true },

  // ── HbA1c ──
  { name: "كاشف / كارتردج HbA1c", device: A1C, codes: ["HBA1C"] },
  { name: "سيطرة HbA1c", device: A1C, codes: [], byHand: true },

  // ── ELISA ──
  elisa("ANA", "ANA"),
  elisa("DSDNA", "Anti-dsDNA"),
  elisa("TTGA", "tTG-IgA"),
  elisa("TTGG", "tTG-IgG"),
  elisa("AGA", "الغليادين (Gliadin IgA/IgG)"),
  elisa("IGA", "IgA الكلي"),
  elisa("TOXOG", "Toxo IgG"),
  elisa("TOXOM", "Toxo IgM"),
  elisa("RUBG", "Rubella IgG"),
  elisa("RUBM", "Rubella IgM"),
  elisa("CMVG", "CMV IgG"),
  elisa("CMVM", "CMV IgM"),
  elisa("HSVG", "HSV 1&2 IgG"),
  elisa("HSVM", "HSV 1&2 IgM"),
  { name: "محلول الغسل (Wash Buffer) — ELISA", device: ELISA, codes: [], byHand: true },

  // ── Rapid cassettes and strips ──
  cassette("HCGB", "الحمل في الدم (HCG)"),
  { name: "شريط الحمل في الإدرار (HCG Strip)", device: RAPID, codes: ["HCGU"] },
  cassette("HPAG", "جرثومة المعدة - مستضد (H. Pylori Ag)"),
  cassette("HPAB", "جرثومة المعدة - أضداد (H. Pylori Ab)"),
  cassette("HBSAG", "التهاب الكبد B (HBsAg)"),
  cassette("HCV", "التهاب الكبد C (HCV)"),
  cassette("HIV", "HIV 1/2"),

  // ── Latex agglutination on the slide (and the rotator) ──
  { name: "كاشف لاتكس CRP", device: LATEX, codes: ["CRP"] },
  { name: "كاشف لاتكس RF", device: LATEX, codes: ["RF"] },
  { name: "كاشف لاتكس ASO", device: LATEX, codes: ["ASO"] },
  { name: "كاشف روز بنغال (Rose Bengal)", device: LATEX, codes: ["ROSE"] },
  { name: "كواشف فايدل (Widal O / H)", device: LATEX, codes: ["WIDAL"] },
  { name: "كاشف RPR / VDRL", device: LATEX, codes: ["VDRL"] },
  { name: "شرائح التلازن السوداء", device: LATEX, codes: [], byHand: true },

  // ── Microscopy: urine, stool, semen ──
  { name: "شرائط فحص الإدرار (Urine Strips)", device: MICRO, codes: ["GUE"] },
  { name: "محلول لوغول (Lugol's Iodine)", device: MICRO, codes: ["GSE"] },
  { name: "صبغة إيوسين-نيغروسين (حيوية النطف)", device: MICRO, codes: ["SFA"] },
  { name: "شرائح زجاجية وأغطية", device: MICRO, codes: [], byHand: true },

  // ── Culture and sensitivity ──
  { name: "أطباق Blood Agar", device: CULTURE, codes: ["CS"] },
  { name: "أطباق MacConkey Agar", device: CULTURE, codes: ["CS"] },
  { name: "أطباق Mueller-Hinton Agar", device: CULTURE, codes: ["CS"] },
  { name: "صبغة غرام (Gram Stain)", device: CULTURE, codes: ["CS"] },
  { name: "أقراص المضادات الحيوية", device: CULTURE, codes: [], byHand: true },
];

const key = (s: string) => s.trim().toLowerCase();
/** The catalog material of this name (case does not matter), if any. */
export const catalogMaterial = (name: string): CatalogMaterial | undefined => LAB_MATERIALS.find((m) => key(m.name) === key(name));
