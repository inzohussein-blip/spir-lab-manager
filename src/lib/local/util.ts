"use client";

import { kvGet, kvSet, kvBytes } from "./kv";

/** Small helpers shared by the standalone local stations (no data sharing). */

export function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = kvGet(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLS<T>(key: string, value: T): boolean {
  try {
    return kvSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
/** Old built-in letterhead lines — the lab now types its own details in Settings.
 *  A saved setting still holding one of these exact defaults is shown as empty. */
const OLD_DEFAULT_LINES = new Set([
  "دبلوم تحليلات مرضية / بكالوريوس علوم حياة",
  "النجف الأشرف - حي ميسان - مقابل بريد ميسان / 0789038080",
]);
export const clearOldDefault = (v?: string) => (v && OLD_DEFAULT_LINES.has(v.trim()) ? "" : v);

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Local calendar date as YYYY-MM-DD. */
export const ymd = (d: Date = new Date()) => d.toLocaleDateString("en-CA");
export const todayYmd = () => ymd(new Date());
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function addMonthsYmd(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return ymd(d);
}
/** Whole days from today to `date` (negative = past). */
export function daysUntil(date: string): number {
  const t = new Date(todayYmd() + "T00:00:00").getTime();
  return Math.round((new Date(date + "T00:00:00").getTime() - t) / 86400000);
}
export const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const AR_MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
export const monthLabel = (ym: string) => `${AR_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Download JSON as a file (ASCII filename, delayed URL revoke). */
export function downloadJson(filename: string, data: unknown): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Bytes this station keeps under the prefix (see ./kv). */
export const usageBytes = (prefix: string): number => kvBytes(prefix);
