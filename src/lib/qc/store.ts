"use client";

/**
 * Standalone Quality & Devices station — daily QC with Westgard rules,
 * temperature logs, and equipment maintenance / calibration. Everything lives
 * in localStorage under "qc.*". Nothing here is shared with any other station.
 */

import { readLS, writeLS, newId, todayYmd, addDays, addMonthsYmd, daysUntil, clearOldDefault } from "@/lib/local/util";

// ── Types ────────────────────────────────────────────────────────────────────
export interface QcLevel { id: string; label: string; lot?: string; mean: number; sd: number; expiry?: string }
export interface Analyte { id: string; name: string; unit?: string; device?: string; levels: QcLevel[]; active: boolean }
/** `mean`/`sd`: the level's targets when the value was entered, so changing a lot's
 *  targets later does not re-judge older results. */
export interface QcResult { id: string; analyteId: string; levelId: string; date: string; at: number; value: number; note?: string; by?: string; mean?: number; sd?: number }

export interface TempUnit { id: string; name: string; kind: string; min: number; max: number }
export interface TempReading { id: string; unitId: string; date: string; slot: "AM" | "PM"; value: number; by?: string; action?: string }

export type Freq = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export const FREQ: Record<Freq, { label: string; days: number }> = {
  daily: { label: "يومي", days: 1 },
  weekly: { label: "أسبوعي", days: 7 },
  monthly: { label: "شهري", days: 30 },
  quarterly: { label: "كل 3 أشهر", days: 91 },
  yearly: { label: "سنوي", days: 365 },
};
export interface DeviceTask { id: string; name: string; freq: Freq; lastDone?: string }
export type LogType = "maintenance" | "fault" | "calibration";
export interface DeviceLog { id: string; date: string; type: LogType; text: string; action?: string; downtime?: number; resolved?: boolean; by?: string }
export interface Device {
  id: string; name: string; model?: string; serial?: string; location?: string;
  vendor?: string; vendorPhone?: string; installed?: string;
  calibMonths?: number; lastCalib?: string;
  tasks: DeviceTask[]; log: DeviceLog[];
}

export interface QcSettings { title: string; subtitle: string; footer?: string; preparedBy?: string }

const K = {
  analytes: "qc.analytes.v1", results: "qc.results.v1", units: "qc.tempUnits.v1", temps: "qc.temps.v1",
  devices: "qc.devices.v1", settings: "qc.settings.v1", seeded: "qc.seeded.v1",
};

function ensureSeed() {
  if (readLS<boolean>(K.seeded, false)) return;
  const lvl = (label: string, mean: number, sd: number): QcLevel => ({ id: newId(), label, mean, sd });
  writeLS<Analyte[]>(K.analytes, [
    { id: newId(), name: "سكر الدم (Glucose)", unit: "mg/dL", device: "محلل الكيمياء", active: true, levels: [lvl("المستوى 1 (طبيعي)", 95, 3), lvl("المستوى 2 (مرتفع)", 250, 7)] },
    { id: newId(), name: "الكوليسترول (Cholesterol)", unit: "mg/dL", device: "محلل الكيمياء", active: true, levels: [lvl("المستوى 1", 180, 5), lvl("المستوى 2", 280, 8)] },
    { id: newId(), name: "الهيموغلوبين (Hb)", unit: "g/dL", device: "محلل الدم", active: true, levels: [lvl("منخفض", 6, 0.2), lvl("طبيعي", 12.5, 0.3), lvl("مرتفع", 16.5, 0.4)] },
  ]);
  writeLS<TempUnit[]>(K.units, [
    { id: newId(), name: "ثلاجة الكواشف", kind: "ثلاجة", min: 2, max: 8 },
    { id: newId(), name: "الفريزر", kind: "فريزر", min: -25, max: -15 },
    { id: newId(), name: "الحاضنة", kind: "حاضنة", min: 36, max: 38 },
    { id: newId(), name: "حرارة الغرفة", kind: "غرفة", min: 18, max: 25 },
  ]);
  const task = (name: string, freq: Freq): DeviceTask => ({ id: newId(), name, freq });
  writeLS<Device[]>(K.devices, [
    { id: newId(), name: "محلل الكيمياء", location: "قسم الكيمياء", calibMonths: 6, log: [],
      tasks: [task("تنظيف المجسّ (Probe)", "daily"), task("فحص مستوى الماء والمحاليل", "daily"), task("تنظيف الفلاتر والخلايا", "weekly"), task("صيانة وقائية شاملة", "monthly")] },
    { id: newId(), name: "محلل الدم (Hematology)", location: "قسم الدم", calibMonths: 6, log: [],
      tasks: [task("التنظيف اليومي وإيقاف التشغيل (Shutdown)", "daily"), task("تنظيف المسارات (Cleaning cycle)", "weekly"), task("صيانة وقائية", "quarterly")] },
    { id: newId(), name: "جهاز الطرد المركزي", location: "غرفة السحب", calibMonths: 12, log: [],
      tasks: [task("تنظيف وتعقيم الحاويات", "weekly"), task("فحص السرعة والمؤقت", "yearly")] },
  ]);
  writeLS(K.seeded, true);
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export function getAnalytes(): Analyte[] { ensureSeed(); return readLS<Analyte[]>(K.analytes, []); }
export function saveAnalytes(a: Analyte[]) { writeLS(K.analytes, a); }
export function getResults(): QcResult[] { ensureSeed(); return readLS<QcResult[]>(K.results, []); }
export function saveResults(r: QcResult[]) { writeLS(K.results, r); }
/** Set one day's value for an analyte level (replaces that day's value; empty clears it). */
export function setResult(analyteId: string, levelId: string, date: string, value: number | null, extra: { note?: string; by?: string } = {}) {
  const rest = getResults().filter((r) => !(r.analyteId === analyteId && r.levelId === levelId && r.date === date));
  const lv = getAnalytes().find((a) => a.id === analyteId)?.levels.find((l) => l.id === levelId);
  if (value != null && Number.isFinite(value)) rest.push({ id: newId(), analyteId, levelId, date, at: Date.now(), value, ...(lv ? { mean: lv.mean, sd: lv.sd } : {}), ...extra });
  saveResults(rest);
}
export function deleteAnalyte(id: string) {
  saveAnalytes(getAnalytes().filter((a) => a.id !== id));
  saveResults(getResults().filter((r) => r.analyteId !== id));
}

export function getUnits(): TempUnit[] { ensureSeed(); return readLS<TempUnit[]>(K.units, []); }
export function saveUnits(u: TempUnit[]) { writeLS(K.units, u); }
export function getTemps(): TempReading[] { ensureSeed(); return readLS<TempReading[]>(K.temps, []); }
export function saveTemps(t: TempReading[]) { writeLS(K.temps, t); }
export function setTemp(unitId: string, date: string, slot: "AM" | "PM", value: number | null, extra: { by?: string; action?: string } = {}) {
  const rest = getTemps().filter((r) => !(r.unitId === unitId && r.date === date && r.slot === slot));
  if (value != null && Number.isFinite(value)) rest.push({ id: newId(), unitId, date, slot, value, ...extra });
  saveTemps(rest);
}
export const tempOk = (u: TempUnit, v: number) => v >= u.min && v <= u.max;

export function getDevices(): Device[] { ensureSeed(); return readLS<Device[]>(K.devices, []); }
export function saveDevices(d: Device[]) { writeLS(K.devices, d); }

export function getSettings(): QcSettings {
  const s = readLS<QcSettings>(K.settings, {
    title: "مختبر التحليلات المرضية", subtitle: "سجلات الجودة والأجهزة",
    footer: "",
  });
  return { ...s, footer: clearOldDefault(s.footer) }; // address/phone is typed by the lab
}
export function saveSettings(s: QcSettings) { writeLS(K.settings, s); }

// ── Westgard rules ───────────────────────────────────────────────────────────
export type RuleCode = "1-2s" | "1-3s" | "2-2s" | "R-4s" | "4-1s" | "10x";
export const RULES: Record<RuleCode, { reject: boolean; text: string }> = {
  "1-2s": { reject: false, text: "تحذير: القيمة خارج ±2SD — راجع قبل الاعتماد" },
  "1-3s": { reject: true, text: "رفض: القيمة خارج ±3SD (خطأ عشوائي)" },
  "2-2s": { reject: true, text: "رفض: قيمتان متتاليتان خارج 2SD بالاتجاه نفسه (خطأ منهجي)" },
  "R-4s": { reject: true, text: "رفض: الفرق بين مستويين في اليوم نفسه أكثر من 4SD (خطأ عشوائي)" },
  "4-1s": { reject: true, text: "رفض: 4 قيم متتالية خارج 1SD بالاتجاه نفسه (خطأ منهجي)" },
  "10x": { reject: true, text: "رفض: 10 قيم متتالية في جهة واحدة من المتوسط (انحياز)" },
};
export interface Evaluation { z: number; rules: RuleCode[]; status: "ok" | "warn" | "reject" }

/** Evaluate every result of one analyte against Westgard multirules. */
export function evaluateAnalyte(a: Analyte, results: QcResult[]): Map<string, Evaluation> {
  const out = new Map<string, Evaluation>();
  const mine = results.filter((r) => r.analyteId === a.id);
  const z = (r: QcResult) => {
    const l = a.levels.find((x) => x.id === r.levelId);
    const mean = r.mean ?? l?.mean, sd = r.sd ?? l?.sd;
    return mean != null && sd != null && sd > 0 ? (r.value - mean) / sd : 0;
  };
  for (const lv of a.levels) {
    const series = mine.filter((r) => r.levelId === lv.id).sort((x, y) => x.date.localeCompare(y.date) || x.at - y.at);
    series.forEach((r, i) => {
      const zi = z(r);
      const rules: RuleCode[] = [];
      if (Math.abs(zi) > 3) rules.push("1-3s");
      const prev = series[i - 1];
      if (prev && Math.abs(zi) > 2 && Math.sign(z(prev)) === Math.sign(zi) && Math.abs(z(prev)) > 2) rules.push("2-2s");
      const last4 = series.slice(Math.max(0, i - 3), i + 1).map(z);
      if (last4.length === 4 && (last4.every((v) => v > 1) || last4.every((v) => v < -1))) rules.push("4-1s");
      const last10 = series.slice(Math.max(0, i - 9), i + 1).map(z);
      if (last10.length === 10 && (last10.every((v) => v > 0) || last10.every((v) => v < 0))) rules.push("10x");
      // Across levels on the same day: R-4s and 2-2s (within run).
      for (const o of mine.filter((x) => x.date === r.date && x.levelId !== r.levelId)) {
        const zo = z(o);
        if ((zi > 2 && zo < -2) || (zi < -2 && zo > 2)) { if (!rules.includes("R-4s")) rules.push("R-4s"); }
        if (Math.abs(zi) > 2 && Math.abs(zo) > 2 && Math.sign(zi) === Math.sign(zo) && !rules.includes("2-2s")) rules.push("2-2s");
      }
      if (!rules.length && Math.abs(zi) > 2) rules.push("1-2s");
      const reject = rules.some((c) => RULES[c].reject);
      out.set(r.id, { z: zi, rules, status: reject ? "reject" : rules.length ? "warn" : "ok" });
    });
  }
  return out;
}

// ── Devices: due dates ───────────────────────────────────────────────────────
export function taskDue(t: DeviceTask): { due: string; days: number } {
  const due = t.lastDone ? addDays(t.lastDone, FREQ[t.freq].days) : todayYmd();
  return { due, days: daysUntil(due) };
}
export function calibDue(d: Device): { due: string; days: number } | null {
  if (!d.calibMonths) return null;
  const due = d.lastCalib ? addMonthsYmd(d.lastCalib, d.calibMonths) : todayYmd();
  return { due, days: daysUntil(due) };
}

// ── Dashboard summary ────────────────────────────────────────────────────────
export function summary() {
  const today = todayYmd();
  const analytes = getAnalytes().filter((a) => a.active);
  const results = getResults();
  const levelsTotal = analytes.reduce((s, a) => s + a.levels.length, 0);
  const levelsDone = analytes.reduce((s, a) => s + a.levels.filter((l) => results.some((r) => r.analyteId === a.id && r.levelId === l.id && r.date === today)).length, 0);
  const since = addDays(today, -7);
  let rejects = 0, warns = 0;
  for (const a of analytes) {
    const ev = evaluateAnalyte(a, results);
    for (const r of results) if (r.analyteId === a.id && r.date >= since) {
      const e = ev.get(r.id);
      if (e?.status === "reject") rejects++; else if (e?.status === "warn") warns++;
    }
  }
  const units = getUnits();
  const temps = getTemps().filter((t) => t.date === today && units.some((u) => u.id === t.unitId));
  const tempsMissing = units.length * 2 - temps.length;
  const tempsOut = temps.filter((t) => { const u = units.find((x) => x.id === t.unitId); return u && !tempOk(u, t.value); }).length;
  const devices = getDevices();
  const tasksDue = devices.reduce((s, d) => s + d.tasks.filter((t) => taskDue(t).days <= 0).length, 0);
  const calibOverdue = devices.filter((d) => { const c = calibDue(d); return c && c.days < 0; }).length;
  const calibSoon = devices.filter((d) => { const c = calibDue(d); return c && c.days >= 0 && c.days <= 30; }).length;
  const openFaults = devices.reduce((s, d) => s + d.log.filter((l) => l.type === "fault" && !l.resolved).length, 0);
  return { levelsTotal, levelsDone, rejects, warns, tempsMissing, tempsOut, tasksDue, calibOverdue, calibSoon, openFaults };
}

// ── Backup ───────────────────────────────────────────────────────────────────
export function exportBackup() {
  return {
    app: "spir-qc", version: 1, exported_at: new Date().toISOString(),
    analytes: getAnalytes(), results: getResults(), units: getUnits(), temps: getTemps(), devices: getDevices(), settings: getSettings(),
  };
}
export function importBackup(data: unknown): boolean {
  const b = data as ReturnType<typeof exportBackup>;
  if (!b || b.app !== "spir-qc" || !Array.isArray(b.analytes)) return false;
  writeLS(K.analytes, b.analytes); writeLS(K.results, b.results ?? []); writeLS(K.units, b.units ?? []);
  writeLS(K.temps, b.temps ?? []); writeLS(K.devices, b.devices ?? []);
  if (b.settings) writeLS(K.settings, b.settings);
  writeLS(K.seeded, true);
  return true;
}
