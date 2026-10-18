"use client";

/**
 * The figures behind the lab station's «لوحة التحكم», «التحليلات» and «لوحة المهام» (new look) —
 * worked out from this device's visits, tests and stock room, nothing sent anywhere.
 *  - pending: a visit with a test whose result is still empty;
 *  - ready: every result written, not handed to the patient yet («حالة التسليم»).
 */
import { getVisits, getTests, getStock, daysToExpiry, type StationVisit } from "./store";

const DAY = 86_400_000;
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA");
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export const isPending = (v: StationVisit) => v.results.some((r) => !String(r.value ?? "").trim());
export const isReady = (v: StationVisit) => v.results.length > 0 && !isPending(v) && !v.delivered_at;
/** How long ago, for the cards ("منذ 3 س"). */
export function ago(ms: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 60) return `منذ ${m} د`;
  const h = Math.round(m / 60);
  return h < 24 ? `منذ ${h} س` : `منذ ${Math.round(h / 24)} يوم`;
}

function perDay(visits: StationVisit[], from: number, days: number, of: (v: StationVisit) => number = () => 1): number[] {
  const out = new Array(days).fill(0);
  for (const v of visits) {
    const i = Math.floor((startOfDay(v.created_at) - from) / DAY);
    if (i >= 0 && i < days) out[i] += of(v);
  }
  return out;
}
function counts<T>(items: T[], key: (x: T) => string | undefined): { name: string; n: number }[] {
  const m = new Map<string, number>();
  for (const x of items) { const k = key(x)?.trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
}

export interface Dashboard {
  today: number; todayTests: number; todayHours: number[];
  month: number; monthChange: number | null;
  pending: number; ready: number; deliveredToday: number;
  low: number; expiring: number;
  week: { label: string; value: number; tone: "dark" | "mid" | "hatch"; note: string; tip: string }[];
  weekTotal: number;
  topTests: { name: string; n: number }[];
  waiting: { id: string; name: string; accession?: string; missing: number; total: number; at: number }[];
  /** Share of this month's visits whose results are all written. */
  doneShare: number;
}

export function dashboardData(now = Date.now()): Dashboard {
  const visits = getVisits();
  const today0 = startOfDay(now);
  const todayV = visits.filter((v) => v.created_at >= today0);
  const d = new Date(now);
  const month0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const prevMonth0 = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  // The same number of days last month, for a fair comparison.
  const prevSame = prevMonth0 + (now - month0);
  const monthV = visits.filter((v) => v.created_at >= month0);
  const prevV = visits.filter((v) => v.created_at >= prevMonth0 && v.created_at < Math.min(prevSame, month0));
  const recent = visits.filter((v) => v.created_at >= now - 60 * DAY);
  const pending = recent.filter(isPending);
  const stock = getStock();
  const week0 = today0 - 6 * DAY;
  const weekCounts = perDay(visits, week0, 7);
  const peak = Math.max(1, ...weekCounts);
  const hours = new Array(24).fill(0);
  for (const v of todayV) hours[new Date(v.created_at).getHours()]++;
  const byId = new Map(getTests().map((t) => [t.id, t]));
  return {
    today: todayV.length,
    todayTests: todayV.reduce((n, v) => n + v.results.length, 0),
    todayHours: hours.slice(7, 22),
    month: monthV.length,
    monthChange: pct(monthV.length, prevV.length),
    pending: pending.length,
    ready: recent.filter(isReady).length,
    deliveredToday: visits.filter((v) => (v.delivered_at ?? 0) >= today0).length,
    low: stock.filter((s) => s.minQty != null && (Number(s.qty) || 0) <= s.minQty).length,
    expiring: stock.filter((s) => { const e = daysToExpiry(s.expiry); return e != null && e <= 30; }).length,
    week: weekCounts.map((n, i) => {
      const day = week0 + i * DAY;
      return {
        label: WEEKDAYS[new Date(day).getDay()].replace(/^ال/, ""),
        value: Math.round((n / peak) * 100),
        tone: n === 0 ? "hatch" : i === 6 ? "dark" : "mid",
        note: n ? String(n) : "",
        tip: `${WEEKDAYS[new Date(day).getDay()]} ${dayKey(day)}: ${n} زيارة`,
      };
    }),
    weekTotal: weekCounts.reduce((a, b) => a + b, 0),
    topTests: counts(monthV.flatMap((v) => v.results), (r) => byId.get(r.testId)?.name_ar ?? r.name_ar).slice(0, 5),
    waiting: pending.sort((a, b) => a.created_at - b.created_at).slice(0, 6).map((v) => ({
      id: v.id, name: v.patient.name, accession: v.accession, at: v.created_at,
      missing: v.results.filter((r) => !String(r.value ?? "").trim()).length, total: v.results.length,
    })),
    doneShare: monthV.length ? Math.round((monthV.filter((v) => !isPending(v)).length / monthV.length) * 100) : 100,
  };
}

export interface Analytics {
  days: number; from: string; to: string;
  kpis: { key: "visits" | "tests" | "patients" | "avg"; label: string; value: number; change: number | null; spark: number[] }[];
  trend: { now: number[]; before: number[]; labels: string[]; rawNow: number[]; rawBefore: number[]; dates: string[] };
  categories: { name: string; n: number }[];
  topTests: { name: string; n: number }[];
  referrers: { name: string; n: number }[];
  heat: { date: string; value: number }[];
}

/** A 7-day moving average (the trend line stays readable on busy and quiet days). */
const avg7 = (xs: number[]) => xs.map((_, i) => { const w = xs.slice(Math.max(0, i - 6), i + 1); return Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10; });

export function analyticsData(days: number, now = Date.now()): Analytics {
  const visits = getVisits();
  const from = startOfDay(now) - (days - 1) * DAY;
  const prevFrom = from - days * DAY;
  const cur = visits.filter((v) => v.created_at >= from);
  const prev = visits.filter((v) => v.created_at >= prevFrom && v.created_at < from);
  const patients = (xs: StationVisit[]) => new Set(xs.map((v) => v.patientId || v.patient.name.trim())).size;
  const tests = (xs: StationVisit[]) => xs.reduce((n, v) => n + v.results.length, 0);
  const avgT = (xs: StationVisit[]) => (xs.length ? Math.round((tests(xs) / xs.length) * 10) / 10 : 0);
  const rawNow = perDay(cur, from, days), rawBefore = perDay(prev, prevFrom, days);
  const dates = rawNow.map((_, i) => dayKey(from + i * DAY));
  const every = Math.max(1, Math.round(days / 6));
  const byId = new Map(getTests().map((t) => [t.id, t]));
  const results = cur.flatMap((v) => v.results);
  const heatFrom = startOfDay(now) - 139 * DAY;
  return {
    days, from: dates[0], to: dates[dates.length - 1],
    kpis: [
      { key: "visits", label: "الزيارات", value: cur.length, change: pct(cur.length, prev.length), spark: rawNow },
      { key: "tests", label: "الفحوصات", value: tests(cur), change: pct(tests(cur), tests(prev)), spark: perDay(cur, from, days, (v) => v.results.length) },
      { key: "patients", label: "المراجعون", value: patients(cur), change: pct(patients(cur), patients(prev)), spark: rawNow },
      { key: "avg", label: "فحوصات لكل زيارة", value: avgT(cur), change: pct(avgT(cur), avgT(prev)), spark: perDay(cur, from, days, (v) => v.results.length).map((n, i) => (rawNow[i] ? n / rawNow[i] : 0)) },
    ],
    trend: { now: avg7(rawNow), before: avg7(rawBefore), labels: dates.map((d, i) => (i % every === 0 ? d.slice(5) : "")), rawNow, rawBefore, dates },
    categories: counts(results, (r) => byId.get(r.testId)?.category || "فحوصات أخرى").slice(0, 8),
    topTests: counts(results, (r) => byId.get(r.testId)?.name_ar ?? r.name_ar).slice(0, 8),
    referrers: counts(cur, (v) => v.referrer).slice(0, 6),
    heat: perDay(visits, heatFrom, 140).map((value, i) => ({ date: dayKey(heatFrom + i * DAY), value })),
  };
}
