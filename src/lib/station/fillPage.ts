import { DENSITY_PAD, GAP_PX, type TableStyle } from "./tableStyle";
import type { StationSettings } from "./store";

/**
 * «ملء الصفحة»: how much larger the results table prints when only a few tests are on the sheet.
 * `font` multiplies the table's text size, `pad` its rows' padding. Settings → «ملء الصفحة» adds
 * ways that are all off by default (see StationSettings.fill*).
 */
export interface Fill { font: number; pad: number }
export const NO_FILL: Fill = { font: 1, pad: 1 };

type Level = NonNullable<StationSettings["fillLevel"]>;
/** «درجة التكبير»: how far the text may grow, and how strongly the fixed steps grow. */
export const FILL_LEVELS: Record<Level, { label: string; cap: number; mult: number }> = {
  light: { label: "خفيف", cap: 1.2, mult: 0.5 },
  medium: { label: "متوسط", cap: 1.5, mult: 1 },
  full: { label: "كامل", cap: 1.9, mult: 1.4 },
};

/** The original fixed steps, by the number of tests. */
export function fillScale(n: number): Fill {
  if (n <= 3) return { font: 1.45, pad: 3 };
  if (n <= 6) return { font: 1.3, pad: 2.3 };
  if (n <= 10) return { font: 1.15, pad: 1.6 };
  if (n <= 14) return { font: 1.05, pad: 1.25 };
  return NO_FILL;
}

/** The fixed steps, stronger on A4 and gentler on A5 («حسب حجم الورق»), and within the chosen level. */
export function fillSteps(n: number, paper: "A4" | "A5", byPaper: boolean, level?: Level): Fill {
  const base = fillScale(n);
  let m = byPaper ? (paper === "A5" ? 0.6 : 1.25) : 1;
  if (level) m *= FILL_LEVELS[level].mult;
  const font = Math.min(1 + (base.font - 1) * m, level ? FILL_LEVELS[level].cap : Infinity);
  return { font: round2(font), pad: round2(Math.max(1, 1 + (base.pad - 1) * m)) };
}

/** One number k for the measured fill: the text grows with k up to its cap, the rows' padding
 *  faster and on past the cap (to its own limit), so a few rows still reach down the page. */
const fromK = (k: number, cap: number): Fill => ({ font: round2(Math.min(k, cap)), pad: round2(Math.min(7, 1 + (k - 1) * 4.4)) });

/** Printable height of the page (mm): the paper less the page margins (see ReportSheet's pageMargin). */
export function pageMm(paper: "A4" | "A5", pre?: { top: number; bottom: number }): number {
  if (pre) return (paper === "A5" ? 210 : 297) - pre.top - pre.bottom;
  return paper === "A5" ? 210 - 7 - 9 : 297 - 10 - 12;
}
const MM = 96 / 25.4;

/** The results table's height (CSS px) at a fill, printed on A4 / A5 or on screen: its title,
 *  header, group rows and rows — each row one line (see `wrap` in smartFill for longer ones). */
export function tableHeight(ts: TableStyle, paper: "A4" | "A5" | "screen", rows: number, groups: number, f: Fill): number {
  const a5 = paper === "A5";
  const font = ts.fontSize * f.font * (a5 ? 10 / 14 : 1);
  const pad = Math.round(DENSITY_PAD[ts.density][a5 ? "a5" : paper === "A4" ? "a4" : "screen"] * f.pad);
  const small = font * 12 / 14;
  const row = font * 1.4286 + 2 * pad + 1;
  const head = small * 1.3333 + 2 * (pad + 2);
  const group = small * 1.3333 + pad + 2 + Math.max(2, pad - 4) + 1;
  return GAP_PX[ts.gap] + 28 + head + groups * group + rows * row + 4;
}

/**
 * «ملء ذكي»: the largest fill whose table still fits the space left on the printed page, given the
 * heights measured on the sheet for everything else (letterhead, patient box, signature…) and
 * `wrap`: how much taller the table is on the sheet than one line per row (long names that wrap).
 */
export function smartFill(ts: TableStyle, paper: "A4" | "A5", rows: number, groups: number, otherPx: number, wrap = 1, pre?: { top: number; bottom: number }, level?: Level): Fill {
  const cap = level ? FILL_LEVELS[level].cap : 1.6;
  const room = (pageMm(paper, pre) * MM - otherPx) * 0.96 - 16; // a little to spare
  let best = 1;
  for (let k = 1; k <= cap + 1.4; k += 0.02) if (tableHeight(ts, paper, rows, groups, fromK(k, cap)) * Math.max(1, wrap) <= room) best = k;
  return best <= 1 ? NO_FILL : fromK(best, cap);
}

/** «معلومات المريض والترويسة أيضاً»: their zoom, following the table's growth. */
export const headZoom = (f: Fill): number => round2(Math.min(1.35, 1 + (f.font - 1) * 0.6));

function round2(n: number): number { return Math.round(n * 100) / 100; }
