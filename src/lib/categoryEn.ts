/** English headings for the built-in test categories (the station's printed results table, and the
 *  admin panel's English report). */
export const CATEGORY_EN: Record<string, string> = {
  "أمراض الدم": "Hematology",
  "وظائف الكلى": "Renal Function Tests",
  "وظائف الكبد": "Liver Function Tests",
  "السكري": "Diabetes",
  "الدهون": "Lipid Profile",
  "الهرمونات": "Hormones",
  "الفيتامينات والحديد": "Vitamins & Iron",
  "العظام والمعادن": "Bone & Minerals",
  "المصليات والمناعة": "Serology & Immunology",
  "حساسية الحنطة": "Wheat Allergy / Celiac",
  "فحوصات TORCH": "TORCH Panel",
  "الفيروسات": "Virology",
  "أدرار": "Urinalysis",
  "الخروج": "Stool Examination",
  "السائل المنوي": "Semen Analysis",
  "الزرع الجرثومي": "Microbiology",
  "فحوصات أخرى": "Other Tests",
  "فحوصات عامة": "General Tests",
};

/** A category's English heading (unknown ones as they are). */
export const categoryEn = (ar: string) => CATEGORY_EN[ar.trim()] ?? ar;
