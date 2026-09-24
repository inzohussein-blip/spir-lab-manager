"use client";

/**
 * Derived (calculated) tests for the Lab Station — optional, off by default
 * (Settings → «الحساب التلقائي للفحوصات المشتقة»). Tests are matched by their
 * built-in `code`, so this works with the default catalog.
 */

import type { StationTest } from "./store";

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

/** Compute every derived value possible from the chosen tests and their results.
 *  Returns testId → { value, formula } for targets that are selected. */
export function computeDerived(chosen: StationTest[], results: Record<string, string>): Record<string, { value: string; formula: string; note?: string }> {
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
      out[target.id] = { value: "", formula: r.formula, note: r.target === "LDL" ? "TG ≥ 400 — لا تصلح معادلة Friedewald" : undefined };
      continue;
    }
    out[target.id] = { value: String(+v.toFixed(r.digits)), formula: r.formula };
  }
  return out;
}
