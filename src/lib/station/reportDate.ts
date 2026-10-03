import type { StationSettings } from "./store";

/**
 * The date (and time) on the printed report (Lab Station → Settings → «التقرير المطبوع ←
 * التاريخ والوقت»). The original — what printed before this option — is the default:
 * «التاريخ: 2026-10-03» at the top beside the sample number, no time, the visit's own date.
 * Latin digits in every form.
 */
export interface ReportDate {
  show: boolean;
  /** 2026-10-03 · 03/10/2026 · 3 تشرين الأول 2026 · 3 Oct 2026 */
  format: "ymd" | "dmy" | "long-ar" | "long-en";
  /** No time, 14:05, or 2:05 م */
  time: "none" | "24h" | "12h";
  /** The visit's registration time (a reprint keeps it), or the moment of printing. */
  source: "visit" | "print";
  /** At the top beside the sample number, or inside the patient's details. */
  place: "head" | "patient";
  /** «التاريخ:», «Date:», or no label. */
  label: "ar" | "en" | "none";
}
export const ORIGINAL_DATE: ReportDate = { show: true, format: "ymd", time: "none", source: "visit", place: "head", label: "ar" };
export const reportDateOf = (s: Pick<StationSettings, "reportDate">): ReportDate => ({ ...ORIGINAL_DATE, ...(s.reportDate ?? {}) });

/** Iraq's month names. */
const MONTHS_AR = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

export function reportDateText(o: ReportDate, ms: number, withTime = true): string {
  const d = new Date(ms);
  const [y, m, day] = [d.getFullYear(), d.getMonth(), d.getDate()];
  const date = o.format === "dmy" ? `${pad(day)}/${pad(m + 1)}/${y}`
    : o.format === "long-ar" ? `${day} ${MONTHS_AR[m]} ${y}`
    : o.format === "long-en" ? `${day} ${MONTHS_EN[m]} ${y}`
    : `${y}-${pad(m + 1)}-${pad(day)}`;
  if (!withTime || o.time === "none") return date;
  const h = d.getHours(), min = pad(d.getMinutes());
  const time = o.time === "24h" ? `${pad(h)}:${min}`
    : `${h % 12 || 12}:${min} ${o.label === "en" ? (h < 12 ? "AM" : "PM") : (h < 12 ? "ص" : "م")}`;
  return `${date}  ${time}`;
}
export const reportDateLabel = (o: ReportDate) => (o.label === "ar" ? "التاريخ:" : o.label === "en" ? "Date:" : "");
