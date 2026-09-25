/**
 * Look of the printed results table (Lab Station → Settings → «جدول النتائج المطبوع»).
 * ORIGINAL is the table exactly as it was before these options existed; DEFAULT is
 * the starting look (the same, with slightly stronger colours).
 */
export interface TableStyle {
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

export const ORIGINAL_TABLE: TableStyle = {
  intensity: 100, fontSize: 14, nameWeight: "medium", layout: "striped", density: "normal", gap: "normal", width: "full",
};
export const DEFAULT_TABLE: TableStyle = { ...ORIGINAL_TABLE, intensity: 115 };

export function tableStyleOf(saved?: Partial<TableStyle>): TableStyle {
  return { ...DEFAULT_TABLE, ...(saved ?? {}) };
}

// Brand colours of the printed report.
export const PURPLE = "#5a2a82";
export const GOLD = "#c9a227";
export const GOLD_DARK = "#9c7c1e";

/** Mix two hex colours: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  const k = Math.max(0, Math.min(1, t));
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}

/** Table colours for a strength (100 = the original colours exactly). */
export function tableColors(intensity: number) {
  const k = intensity / 100;
  const up = Math.max(0, k - 1), down = Math.max(0, 1 - k);
  return {
    header: up ? mix(PURPLE, "#000000", up * 0.7) : mix(PURPLE, "#ffffff", down * 1.2),
    groupText: up ? mix(PURPLE, "#000000", up * 0.7) : PURPLE,
    groupBg: up ? mix("#fbf6e4", GOLD, up * 0.35) : mix("#fbf6e4", "#ffffff", down),
    stripe: up ? mix("#f7f3fb", PURPLE, up * 0.12) : mix("#f7f3fb", "#ffffff", down),
    border: up ? mix(GOLD, GOLD_DARK, up * 2) : mix(GOLD, "#ffffff", down * 1.2),
    muted: up ? mix("#4b5563", "#111827", up * 2) : mix("#4b5563", "#9ca3af", down * 1.5),
    line: up ? mix("#e5dcc0", GOLD, up) : mix("#e5dcc0", "#ffffff", down),
  };
}

/** Vertical cell padding in px for the sheet on screen / A4 print / A5 print. */
export const DENSITY_PAD: Record<TableStyle["density"], { screen: number; a4: number; a5: number }> = {
  compact: { screen: 5, a4: 3, a5: 2 },
  normal: { screen: 8, a4: 5, a5: 3 },
  relaxed: { screen: 11, a4: 8, a5: 5 },
};
export const GAP_PX: Record<TableStyle["gap"], number> = { near: 8, normal: 20, far: 36 };
