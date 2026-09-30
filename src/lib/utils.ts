import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Dates everywhere in one numeric form, with Latin digits and months as numbers:
 *  2026-09-30, and 2026-09-30 14:05 (kept left-to-right inside Arabic text). */
const pad = (n: number) => String(n).padStart(2, "0");
export function fmtDate(v: number | string | Date | null | undefined): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDateTime(v: number | string | Date | null | undefined): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `\u2066${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}\u2069`;
}

/** Currency label used across the app (Iraqi Dinar). */
export const CURRENCY = "د.ع";

/** Format a number for the financial views. The Iraqi Dinar is used in whole
 *  units (no fils in practice), so amounts are grouped with no decimals.
 *  Uses Latin numerals (1,2,3) rather than Arabic-Indic. */
export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("ar-IQ-u-nu-latn", { maximumFractionDigits: 0 });
}
