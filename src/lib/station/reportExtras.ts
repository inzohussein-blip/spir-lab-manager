import type { StationSettings } from "./store";

/**
 * Extra options for the printed report (Lab Station → Settings → «خيارات إضافية للتقرير المطبوع»),
 * each off by default so the report stays as it was:
 *  - pre-printed paper: the lab prints on its own letterhead paper, so the sheet leaves blank
 *    space at the top and bottom and prints no letterhead, footer bar or watermark;
 *  - logo placement and watermark;
 *  - the report's font (bundled with the app, so it works offline too).
 */
export interface ReportHead {
  /** Where the logo sits: beside the name (original), at the far side, or centred above the name. */
  logo: "start" | "end" | "center";
  logoSize: "small" | "medium" | "large";
  watermark: boolean;
  wmSize: "small" | "medium" | "large";
  /** Watermark opacity in % (original 6). */
  wmOpacity: number;
}

export const ORIGINAL_HEAD: ReportHead = { logo: "start", logoSize: "medium", watermark: true, wmSize: "medium", wmOpacity: 6 };

export const LOGO_PX: Record<ReportHead["logoSize"], number> = { small: 56, medium: 80, large: 104 };
/** Watermark width: share of the sheet, and its most in mm. */
export const WM_SIZE: Record<ReportHead["wmSize"], { pct: number; maxMm: number }> = {
  small: { pct: 33, maxMm: 75 }, medium: { pct: 50, maxMm: 110 }, large: { pct: 70, maxMm: 150 },
};

export const REPORT_FONTS: { id: string; name: string; family: string }[] = [
  { id: "plex", name: "IBM Plex (خط التطبيق)", family: '"IBM Plex Sans Arabic"' },
  { id: "cairo", name: "Cairo", family: '"Cairo"' },
  { id: "tajawal", name: "Tajawal", family: '"Tajawal"' },
  { id: "naskh", name: "Noto Naskh (نسخ)", family: '"Noto Naskh Arabic"' },
  { id: "amiri", name: "Amiri (أميري)", family: '"Amiri"' },
];

export const PRE_TOP_DEFAULT = 40;
export const PRE_BOTTOM_DEFAULT = 25;
const mm = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(120, Math.round(n)) : d;
};

export interface ReportExtras {
  /** Blank space (mm) for the pre-printed paper, or null. */
  pre: { top: number; bottom: number } | null;
  head: ReportHead;
  /** CSS font-family for the sheet, or null for the app's font. */
  font: string | null;
}

/** What the report uses: an option's values only while it is switched on. */
export function reportExtrasOf(s: StationSettings): ReportExtras {
  const h = { ...ORIGINAL_HEAD, ...(s.reportHeadOn ? s.reportHead ?? {} : {}) };
  h.wmOpacity = Math.max(2, Math.min(20, Number(h.wmOpacity) || ORIGINAL_HEAD.wmOpacity));
  const f = s.reportFontOn ? REPORT_FONTS.find((x) => x.id === s.reportFont) : undefined;
  return {
    pre: s.prePrinted ? { top: mm(s.prePrintedTop, PRE_TOP_DEFAULT), bottom: mm(s.prePrintedBottom, PRE_BOTTOM_DEFAULT) } : null,
    head: h,
    font: f && f.id !== "plex" ? `${f.family}, var(--font-sans)` : null,
  };
}
