/**
 * The built-in test catalogue — shared by the Lab Station (its default list) and the full admin
 * panel (Settings → «استيراد قائمة الفحوصات الافتراضية»). No browser or server APIs here.
 */
import type { NormalRange, StationTest } from "./store";

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ── Default catalog — includes sex-specific and qualitative ranges ───────────
export type DefaultTest = StationTest & {
  /** Older built-in names this entry replaces (avoids duplicates on merge). */
  aliases?: string[];
  /** Previous built-in range — replaced only if the user never edited it. */
  legacy?: NormalRange;
};

export function DEFAULT_TESTS(): DefaultTest[] {
  const num = (low: number | null, high: number | null, note?: string): NormalRange =>
    note ? { kind: "numeric", low, high, note } : { kind: "numeric", low, high };
  const sex = (m: [number | null, number | null], f: [number | null, number | null], note?: string): NormalRange => ({
    kind: "sex", male: { low: m[0], high: m[1] }, female: { low: f[0], high: f[1] }, ...(note ? { note } : {}),
  });
  const neg = (text = "Negative", cutoff?: number): NormalRange =>
    cutoff != null ? { kind: "qual", text, cutoff } : { kind: "qual", text };

  let cat = "";
  let sample = "دم";
  const list: DefaultTest[] = [];
  const add = (code: string, name_ar: string, name_en: string, unit: string, normal: NormalRange, extra: Partial<DefaultTest> = {}) =>
    list.push({ id: uid(), code, name_ar, name_en, category: cat, sample_type: extra.sample_type ?? sample, unit, normal, ...extra });

  cat = "أمراض الدم";
  add("HB", "الهيموغلوبين (Hb)", "Hemoglobin", "g/dL", sex([13, 17], [12, 15]));
  add("HCT", "الهيماتوكريت (HCT)", "Hematocrit", "%", sex([40, 54], [36, 48]));
  add("WBC", "كريات الدم البيضاء (WBC)", "White Blood Cells", "10^3/µL", num(4, 11));
  add("PLT", "الصفائح الدموية (PLT)", "Platelets", "10^3/µL", num(150, 450));

  cat = "وظائف الكلى";
  add("UREA", "اليوريا (Urea)", "Urea", "mg/dL", num(15, 45));
  add("CREA", "الكرياتينين (Creatinine)", "Creatinine", "mg/dL", num(0.6, 1.2, "Adults"), {
    aliases: ["الكرياتينين"], legacy: sex([0.7, 1.3], [0.6, 1.1]),
  });
  add("UA", "حمض اليوريك (Uric Acid)", "Uric Acid", "mg/dL", sex([3.4, 7.0], [2.4, 6.0]));
  add("BUN", "نيتروجين يوريا الدم (BUN)", "Blood Urea Nitrogen", "mg/dL", num(7, 20));
  add("EGFR", "معدل الترشيح الكبيبي (eGFR)", "Estimated GFR", "mL/min/1.73m²", num(90, null));
  add("NA", "الصوديوم (Na+)", "Sodium", "mEq/L", num(135, 145));
  add("K", "البوتاسيوم (K+)", "Potassium", "mEq/L", num(3.5, 5.1));
  add("CL", "الكلورايد (Cl-)", "Chloride", "mEq/L", num(96, 106));

  cat = "وظائف الكبد";
  add("ALT", "إنزيم ALT (SGPT)", "ALT (SGPT)", "U/L", sex([null, 41], [null, 33]));
  add("AST", "إنزيم AST (SGOT)", "AST (SGOT)", "U/L", num(null, 40));
  add("ALP", "الفوسفاتيز القلوي (ALP)", "Alkaline Phosphatase", "U/L", num(40, 129, "Adults"));
  add("TSB", "البيليروبين الكلي (TSB)", "Total Bilirubin", "mg/dL", num(0.2, 1.2));
  add("DBIL", "البيليروبين المباشر (Direct)", "Direct Bilirubin", "mg/dL", num(0.0, 0.3));
  add("IBIL", "البيليروبين غير المباشر (Indirect)", "Indirect Bilirubin", "mg/dL", num(0.2, 0.8));
  add("GGT", "إنزيم GGT", "Gamma-Glutamyl Transferase", "U/L", sex([8, 61], [5, 36]));
  add("TP", "البروتين الكلي (Total Protein)", "Total Protein", "g/dL", num(6.0, 8.3));
  add("ALB", "الألبومين (Albumin)", "Albumin", "g/dL", num(3.5, 5.2));
  add("GLOB", "الغلوبيولين (Globulin)", "Globulin", "g/dL", num(2.0, 3.5));

  cat = "السكري";
  add("FBS", "سكر صائم (FBS)", "Fasting Blood Sugar", "mg/dL", num(70, 99), { legacy: num(70, 110) });
  add("RBS", "سكر عشوائي (RBS)", "Random Blood Sugar", "mg/dL", num(70, 140));
  add("PPG2", "سكر بعد الأكل بساعتين (2h PPG)", "2-Hour Postprandial Glucose", "mg/dL", num(null, 140));
  add("HBA1C", "السكر التراكمي (HbA1c)", "Glycated Hemoglobin", "%", num(null, 5.7, "5.7 – 6.4 Prediabetes"));
  add("INS", "الأنسولين الصائم (Insulin)", "Fasting Insulin", "µIU/mL", num(2.6, 24.9));
  add("HOMA", "مقاومة الأنسولين (HOMA-IR)", "HOMA-IR", "", num(null, 1.9, "Optimal"));
  add("GTT", "اختبار تحمّل السكر (GTT)", "Glucose Tolerance Test", "mg/dL",
    { kind: "text", text: "Fasting < 95, 1h < 180, 2h < 155, 3h < 140 mg/dL" });

  cat = "الدهون";
  add("CHOL", "الكوليسترول الكلي (Cholesterol)", "Total Cholesterol", "mg/dL", num(null, 200));
  add("TG", "الدهون الثلاثية (TG)", "Triglycerides", "mg/dL", num(null, 150));
  add("HDL", "الكوليسترول الجيد (HDL)", "HDL Cholesterol", "mg/dL", sex([40, null], [50, null]));
  add("LDL", "الكوليسترول الضار (LDL)", "LDL Cholesterol", "mg/dL", num(null, 100));
  add("VLDL", "الكوليسترول (VLDL)", "VLDL", "mg/dL", num(5, 40));

  cat = "الهرمونات";
  add("TSH", "هرمون TSH", "Thyroid Stimulating Hormone", "µIU/mL", num(0.27, 4.2));
  add("TT3", "T3 الكلي (Total T3)", "Total T3", "ng/mL", num(0.8, 2.0));
  add("TT4", "T4 الكلي (Total T4)", "Total T4", "µg/dL", num(5.1, 14.1));
  add("FT3", "T3 الحر (FT3)", "Free T3", "pg/mL", num(2.0, 4.4));
  add("FT4", "T4 الحر (FT4)", "Free T4", "ng/dL", num(0.93, 1.7));
  add("FSH", "هرمون FSH", "Follicle-Stimulating Hormone", "mIU/mL", num(1.5, 12.4, "Follicular Phase"));
  add("LH", "هرمون LH", "Luteinizing Hormone", "mIU/mL", num(2.4, 12.6, "Follicular Phase"));
  add("PRL", "هرمون الحليب (Prolactin)", "Prolactin", "ng/mL", sex([4.0, 15.2], [4.0, 23.3], "Female: non-pregnant"));
  add("TESTO", "التستوستيرون الكلي (Total Testosterone)", "Total Testosterone", "ng/dL", sex([240, 870], [15, 70]));
  add("FTESTO", "التستوستيرون الحر (Free Testosterone)", "Free Testosterone", "pg/mL", sex([4.5, 25.0], [null, null]));
  add("BHCG", "هرمون الحمل الكمي (β-HCG)", "Beta-HCG (Quantitative)", "mIU/mL", neg("Negative (< 5 mIU/mL)", 5));
  add("HCGB", "هرمون الحمل في الدم (نوعي)", "HCG in Blood (Qualitative)", "", neg());
  add("HCGU", "هرمون الحمل في الإدرار", "HCG in Urine", "", neg(), { sample_type: "إدرار" });
  add("AMH", "هرمون AMH", "Anti-Müllerian Hormone", "ng/mL", num(1.0, 4.0));
  add("PROG", "البروجستيرون (Progesterone)", "Progesterone", "ng/mL", num(1.8, 24.0, "Luteal Phase"));
  add("E2", "الإستراديول (E2)", "Estradiol", "pg/mL", num(12.5, 166.0, "Follicular Phase"));
  add("CORT", "الكورتيزول الصباحي (Cortisol AM)", "Cortisol (AM)", "nmol/L", num(77, 317, "6.2 – 19.4 µg/dL"));

  cat = "الفيتامينات والحديد";
  add("VITD", "فيتامين D3 (25-OH)", "Vitamin D3 (25-OH Vitamin D)", "ng/mL", num(30, 100, "Sufficient"));
  add("B12", "فيتامين B12", "Vitamin B12", "pg/mL", num(211, 911));
  add("FERR", "مخزون الحديد (Ferritin)", "Serum Ferritin", "ng/mL", sex([30, 400], [13, 150]));
  add("FE", "الحديد في الدم (Serum Iron)", "Serum Iron", "µg/dL", sex([65, 175], [50, 170]));
  add("TIBC", "سعة ربط الحديد (TIBC)", "Total Iron Binding Capacity", "µg/dL", num(250, 450));
  add("ZN", "الزنك (Zinc)", "Zinc (Serum)", "µg/dL", num(70, 120));
  add("FOL", "حمض الفوليك (Folic Acid)", "Folic Acid (Vitamin B9)", "ng/mL", num(4.6, 18.7));

  cat = "العظام والمعادن";
  add("CA", "الكالسيوم الكلي (Total Ca)", "Total Calcium", "mg/dL", num(8.6, 10.2));
  add("ICA", "الكالسيوم المتأيّن (Ionized Ca)", "Ionized Calcium", "mg/dL", num(4.5, 5.6));
  add("PHOS", "الفسفور (Phosphorus)", "Inorganic Phosphorus", "mg/dL", num(2.5, 4.5));
  add("MG", "المغنيسيوم (Mg)", "Magnesium", "mg/dL", num(1.7, 2.2));
  add("PTH", "هرمون الجار درقية (PTH)", "Parathyroid Hormone", "pg/mL", num(15, 65));

  cat = "المصليات والمناعة";
  add("CRP", "البروتين التفاعلي (CRP)", "C-Reactive Protein", "mg/L", neg("Negative (< 6 mg/L)", 6));
  add("RF", "عامل الروماتيزم (RF)", "Rheumatoid Factor", "IU/mL", neg("Negative (< 8 IU/mL)", 8));
  add("ASO", "أضداد الستربتوليسين (ASO)", "Anti-Streptolysin O", "IU/mL", neg("Negative (< 200 IU/mL)", 200));
  add("ROSE", "الحمى المالطية (Rose Bengal)", "Rose Bengal (Brucella)", "", neg());
  add("WIDAL", "فحص التيفوئيد (Widal)", "Widal Test", "", neg("Negative (< 1:80)", 80));
  add("HPAG", "جرثومة المعدة - مستضد (H. Pylori Ag)", "H. Pylori Antigen (Stool)", "", neg(), { sample_type: "براز" });
  add("HPAB", "جرثومة المعدة - أضداد (H. Pylori Ab)", "H. Pylori Antibody (IgG / IgM)", "", neg());
  add("ANA", "الأضداد النووية (ANA)", "Antinuclear Antibodies", "", neg("Negative (< 1:40)", 40));
  add("DSDNA", "أضداد Anti-dsDNA", "Anti-dsDNA", "IU/mL", neg("Negative (< 10 IU/mL)", 10));

  cat = "حساسية الحنطة";
  add("TTGA", "أضداد tTG-IgA", "Anti-Tissue Transglutaminase IgA", "U/mL", neg("Negative (< 10 U/mL)", 10));
  add("TTGG", "أضداد tTG-IgG", "Anti-Tissue Transglutaminase IgG", "U/mL", neg("Negative (< 10 U/mL)", 10));
  add("AGA", "أضداد الغليادين (IgA / IgG)", "Anti-Gliadin Antibodies", "U/mL", neg("Negative (< 12 U/mL)", 12));
  add("IGA", "IgA الكلي (Total IgA)", "Total Serum IgA", "mg/dL", num(70, 400));

  cat = "فحوصات TORCH";
  add("TOXOG", "داء المقوّسات (Toxo) IgG", "Toxoplasma gondii IgG", "", neg());
  add("TOXOM", "داء المقوّسات (Toxo) IgM", "Toxoplasma gondii IgM", "", neg());
  add("RUBG", "الحصبة الألمانية (Rubella) IgG", "Rubella IgG", "", neg());
  add("RUBM", "الحصبة الألمانية (Rubella) IgM", "Rubella IgM", "", neg());
  add("CMVG", "الفيروس المضخّم (CMV) IgG", "Cytomegalovirus IgG", "", neg());
  add("CMVM", "الفيروس المضخّم (CMV) IgM", "Cytomegalovirus IgM", "", neg());
  add("HSVG", "فيروس الهربس (HSV 1&2) IgG", "Herpes Simplex IgG", "", neg());
  add("HSVM", "فيروس الهربس (HSV 1&2) IgM", "Herpes Simplex IgM", "", neg());

  cat = "الفيروسات";
  add("HBSAG", "التهاب الكبد B (HBsAg)", "Hepatitis B Surface Antigen", "", neg());
  add("HCV", "التهاب الكبد C (HCV Ab)", "Hepatitis C Antibody", "", neg());
  add("HIV", "فيروس نقص المناعة (HIV 1/2)", "HIV 1/2 Ab/Ag", "", neg());
  add("VDRL", "الزهري (VDRL / RPR)", "Syphilis Screen", "", neg("Non-Reactive (Negative)"));

  cat = "أدرار";
  sample = "إدرار";
  add("GUE", "فحص الإدرار العام (G.U.E)", "General Urine Examination", "", { kind: "text", text: "Normal" });

  // Structured report forms (see ./templates): entered through a form, printed on their own page.
  cat = "الخروج";
  sample = "خروج";
  add("GSE", "فحص الخروج العام (GSE)", "General Stool Examination", "", { kind: "none" });
  cat = "السائل المنوي";
  sample = "سائل منوي";
  add("SFA", "تحليل السائل المنوي", "Seminal Fluid Analysis", "", { kind: "none" });
  cat = "الزرع الجرثومي";
  sample = "حسب نوع العينة";
  add("CS", "الزرع والحساسية (Culture & Sensitivity)", "Culture & Sensitivity", "", { kind: "none" });

  return list;
}
