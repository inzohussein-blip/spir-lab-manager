/**
 * Look of the printed report (Lab Station → Settings → «التقرير المطبوع: الألوان والجدول»).
 * ORIGINAL is the report exactly as it was before these options existed; DEFAULT is
 * the starting look (the same, with slightly stronger colours).
 */
export interface TableStyle {
  /** The lab's main colour (letterhead, table header, footer bar), as #rrggbb. */
  primary: string;
  /** Its second colour (rules, frames, sub-title), as #rrggbb. */
  accent: string;
  /** Colour strength in % (100 = original colours). */
  intensity: number;
  /** Body text size in px on an A4 sheet (A5 scales down automatically). */
  fontSize: number;
  /** Weight of the test names. */
  nameWeight: "normal" | "medium" | "bold";
  /** Table look: stripes (original) / horizontal lines / full grid / plain. */
  layout: "striped" | "lines" | "grid" | "plain";
  /** Row height. */
  density: "compact" | "normal" | "relaxed";
  /** Distance between the patient box and the table. */
  gap: "near" | "normal" | "far";
  /** Full page width, or narrower with side margins. */
  width: "full" | "inset";
}

// Brand colours of the printed report (the lab's original letterhead).
export const PURPLE = "#5a2a82";
export const GOLD = "#c9a227";
export const GOLD_DARK = "#9c7c1e";

export const ORIGINAL_TABLE: TableStyle = {
  primary: PURPLE, accent: GOLD, intensity: 100, fontSize: 14, nameWeight: "medium", layout: "striped", density: "normal", gap: "normal", width: "full",
};
export const DEFAULT_TABLE: TableStyle = { ...ORIGINAL_TABLE, intensity: 115 };

const HEX = /^#[0-9a-f]{6}$/i;

export function tableStyleOf(saved?: Partial<TableStyle>): TableStyle {
  const t = { ...DEFAULT_TABLE, ...(saved ?? {}) };
  if (!HEX.test(t.primary)) t.primary = PURPLE;
  if (!HEX.test(t.accent)) t.accent = GOLD;
  t.primary = t.primary.toLowerCase(); t.accent = t.accent.toLowerCase();
  return t;
}

/** Ready colour pairs for the report (the first is the original). */
export const REPORT_PALETTES: { name: string; primary: string; accent: string }[] = [
  { name: "بنفسجي وذهبي (الأصلي)", primary: PURPLE, accent: GOLD },
  { name: "أزرق طبي", primary: "#1e4f91", accent: "#4fa3d9" },
  { name: "كحلي وذهبي", primary: "#1f2f55", accent: "#c9a227" },
  { name: "أخضر", primary: "#1f6b45", accent: "#8cbf3f" },
  { name: "تركوازي", primary: "#0f6b73", accent: "#3fb8b0" },
  { name: "عنابي", primary: "#7a1f35", accent: "#d08a5a" },
  { name: "أحمر", primary: "#a32020", accent: "#e0a030" },
  { name: "رمادي داكن", primary: "#374151", accent: "#9ca3af" },
];

/** Mix two hex colours: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  const k = Math.max(0, Math.min(1, t));
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}

/** The light tints and dark shade made from the two colours (for the original pair: its own
 *  hand-picked tints, so the original report is unchanged). */
function tintsOf(primary: string, accent: string) {
  if (primary === PURPLE && accent === GOLD) return { groupBg: "#fbf6e4", stripe: "#f7f3fb", line: "#e5dcc0", accentDark: GOLD_DARK };
  return { groupBg: mix(accent, "#ffffff", 0.9), stripe: mix(primary, "#ffffff", 0.95), line: mix(accent, "#ffffff", 0.6), accentDark: mix(accent, "#000000", 0.25) };
}

/** Report colours for the chosen pair and strength (100 = the colours exactly as chosen). */
export function tableColors(intensity: number, primary = PURPLE, accent = GOLD) {
  const k = intensity / 100;
  const up = Math.max(0, k - 1), down = Math.max(0, 1 - k);
  const t = tintsOf(primary, accent);
  const main = up ? mix(primary, "#000000", up * 0.7) : primary;
  return {
    header: up ? main : mix(primary, "#ffffff", down * 1.2),
    groupText: main,
    groupBg: up ? mix(t.groupBg, accent, up * 0.35) : mix(t.groupBg, "#ffffff", down),
    stripe: up ? mix(t.stripe, primary, up * 0.12) : mix(t.stripe, "#ffffff", down),
    border: up ? mix(accent, t.accentDark, up * 2) : mix(accent, "#ffffff", down * 1.2),
    muted: up ? mix("#4b5563", "#111827", up * 2) : mix("#4b5563", "#9ca3af", down * 1.5),
    line: up ? mix(t.line, accent, up) : mix(t.line, "#ffffff", down),
    /** Letterhead: the lab's name and labels, its sub-title, and the footer bar. */
    title: main,
    subtitle: up ? mix(t.accentDark, "#000000", up * 0.7) : mix(t.accentDark, "#ffffff", down),
    bar: up ? main : mix(primary, "#ffffff", down * 0.8),
  };
}

/** The colours for a saved look. */
export const reportColors = (ts: TableStyle) => tableColors(ts.intensity, ts.primary, ts.accent);

/** Vertical cell padding in px for the sheet on screen / A4 print / A5 print. */
export const DENSITY_PAD: Record<TableStyle["density"], { screen: number; a4: number; a5: number }> = {
  compact: { screen: 5, a4: 3, a5: 2 },
  normal: { screen: 8, a4: 5, a5: 3 },
  relaxed: { screen: 11, a4: 8, a5: 5 },
};
export const GAP_PX: Record<TableStyle["gap"], number> = { near: 8, normal: 20, far: 36 };
