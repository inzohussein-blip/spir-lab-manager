"use client";

/**
 * Derived (calculated) tests for the Lab Station — optional, off by default
 * (Settings → «الحساب التلقائي للفحوصات المشتقة»). Tests are matched by their
 * built-in `code`, so this works with the default catalog.
 */

import type { StationTest, Gender } from "./store";

export interface DerivedRule {
  target: string;          // code of the calculated test
  inputs: string[];        // codes it needs
  formula: string;         // shown to the user
  digits: number;
  calc: (v: Record<string, number>) => number | null;
}

export const DERIVED: DerivedRule[] = [
  { target: "IBIL", inputs: ["TSB", "DBIL"], formula: "البيليروبين الكلي − المباشر", digits: 2, calc: (v) => v.TSB - v.DBIL },
  { target: "GLOB", inputs: ["TP", "ALB"], formula: "البروتين الكلي − الألبومين", digits: 1, calc: (v) => v.TP - v.ALB },
  { target: "VLDL", inputs: ["TG"], formula: "الدهون الثلاثية ÷ 5", digits: 0, calc: (v) => v.TG / 5 },
  // Friedewald is not valid when TG ≥ 400 mg/dL.
  { target: "LDL", inputs: ["CHOL", "HDL", "TG"], formula: "الكوليسترول − HDL − (TG ÷ 5)", digits: 0, calc: (v) => (v.TG >= 400 ? null : v.CHOL - v.HDL - v.TG / 5) },
  { target: "BUN", inputs: ["UREA"], formula: "اليوريا ÷ 2.14", digits: 1, calc: (v) => v.UREA / 2.14 },
  { target: "HOMA", inputs: ["FBS", "INS"], formula: "السكر (mg/dL) × الأنسولين ÷ 405", digits: 2, calc: (v) => (v.FBS * v.INS) / 405 },
];

/** Extra optional calculations (each off by default, enabled under the main switch in Settings). */
export interface DerivedOptions {
  /** eGFR by CKD-EPI 2021 from creatinine, age (years) and sex. */
  egfr?: boolean;
  /** LDL by the Sampson (NIH) equation when TG is 400–800 mg/dL. */
  sampson?: boolean;
  age?: string;
  gender?: Gender;
}

/** Age in whole years from the free-text age field; null when not given in years. */
function ageYears(raw?: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:سنة|سنه|سنوات|عام|y|yr|yrs|years?)?\s*$/i.exec(raw ?? "");
  return m ? Number(m[1]) : null;
}

/** CKD-EPI 2021 (race-free), creatinine in mg/dL. */
export function ckdEpi2021(scr: number, age: number, female: boolean): number {
  const k = female ? 0.7 : 0.9, a = female ? -0.241 : -0.302;
  return 142 * Math.min(scr / k, 1) ** a * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
}

/** Sampson / NIH equation 2 (valid for TG up to 800 mg/dL). */
export function ldlSampson(tc: number, hdl: number, tg: number): number {
  const nonHdl = tc - hdl;
  return tc / 0.948 - hdl / 0.971 - (tg / 8.56 + (tg * nonHdl) / 2140 - (tg * tg) / 16100) - 9.44;
}

/** Compute every derived value possible from the chosen tests and their results.
 *  Returns testId → { value, formula } for targets that are selected. */
export function computeDerived(chosen: StationTest[], results: Record<string, string>, opts: DerivedOptions = {}): Record<string, { value: string; formula: string; note?: string }> {
  const byCode = new Map(chosen.filter((t) => t.code).map((t) => [t.code as string, t]));
  const out: Record<string, { value: string; formula: string; note?: string }> = {};
  for (const r of DERIVED) {
    const target = byCode.get(r.target);
    if (!target) continue;
    const vals: Record<string, number> = {};
    let ok = true;
    for (const c of r.inputs) {
      const t = byCode.get(c);
      const n = t ? Number((results[t.id] ?? "").trim()) : NaN;
      if (!t || !(results[t.id] ?? "").trim() || !Number.isFinite(n)) { ok = false; break; }
      vals[c] = n;
    }
    if (!ok) continue;
    const v = r.calc(vals);
    if (v == null || !Number.isFinite(v)) {
      if (r.target === "LDL" && opts.sampson && vals.TG <= 800) {
        out[target.id] = { value: String(Math.round(ldlSampson(vals.CHOL, vals.HDL, vals.TG))), formula: "معادلة Sampson (NIH) — TG بين 400 و800" };
        continue;
      }
      out[target.id] = {
        value: "", formula: r.formula,
        note: r.target === "LDL" ? (opts.sampson ? "TG > 800 — يُقاس LDL مباشرة" : "TG ≥ 400 — لا تصلح معادلة Friedewald") : undefined,
      };
      continue;
    }
    out[target.id] = { value: String(+v.toFixed(r.digits)), formula: r.formula };
  }

  // eGFR (CKD-EPI 2021) — adults only, needs sex and age in years.
  const egfr = opts.egfr ? byCode.get("EGFR") : undefined;
  const crea = byCode.get("CREA");
  const scrRaw = crea ? (results[crea.id] ?? "").trim() : "";
  const scr = Number(scrRaw);
  if (egfr && crea && scrRaw && Number.isFinite(scr) && scr > 0) {
    const formula = "CKD-EPI 2021 (الكرياتينين، العمر، الجنس)";
    const age = ageYears(opts.age);
    if (opts.gender !== "male" && opts.gender !== "female") out[egfr.id] = { value: "", formula, note: "حدّد الجنس لحسابه" };
    else if (age == null) out[egfr.id] = { value: "", formula, note: "أدخل العمر بالسنوات لحسابه" };
    else if (age < 18) out[egfr.id] = { value: "", formula, note: "المعادلة للبالغين فقط (18 سنة فأكثر)" };
    else out[egfr.id] = { value: String(Math.round(ckdEpi2021(scr, age, opts.gender === "female"))), formula };
  }
  return out;
}
