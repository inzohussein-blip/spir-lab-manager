"use client";

/**
 * Standalone Staff & Shifts station — weekly roster, attendance, leaves,
 * advances and a monthly payroll sheet. localStorage under "roster.*";
 * nothing is shared with any other station.
 */

import { readLS, writeLS, newId, todayYmd, addDays } from "@/lib/local/util";

export interface Staff { id: string; name: string; role?: string; phone?: string; hireDate?: string; salary?: number; color: string; active: boolean }
export interface ShiftType { id: string; name: string; start: string; end: string; color: string }
export interface Attendance { id: string; staffId: string; date: string; in?: string; out?: string; note?: string }
export type LeaveType = "annual" | "sick" | "emergency" | "unpaid";
export const LEAVE_TYPES: Record<LeaveType, string> = { annual: "سنوية", sick: "مرضية", emergency: "طارئة", unpaid: "بدون راتب" };
export interface Leave { id: string; staffId: string; type: LeaveType; from: string; to: string; note?: string }
export interface Advance { id: string; staffId: string; date: string; amount: number; deductMonth: string; note?: string }
export interface RosterSettings {
  title: string; subtitle: string; footer?: string;
  graceMin: number; annualLeaveDays: number;
  /** 0 = Sunday … 6 = Saturday */
  weekStart: number;
}

const K = {
  staff: "roster.staff.v1", shifts: "roster.shifts.v1", schedule: "roster.schedule.v1", attendance: "roster.attendance.v1",
  leaves: "roster.leaves.v1", advances: "roster.advances.v1", settings: "roster.settings.v1", seeded: "roster.seeded.v1",
};
export const OFF = "off";
export const STAFF_COLORS = ["#0284c7", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#dc2626", "#4f46e5"];

function ensureSeed() {
  if (readLS<boolean>(K.seeded, false)) return;
  writeLS<ShiftType[]>(K.shifts, [
    { id: newId(), name: "صباحي", start: "08:00", end: "14:00", color: "#0ea5e9" },
    { id: newId(), name: "مسائي", start: "14:00", end: "20:00", color: "#f59e0b" },
    { id: newId(), name: "ليلي", start: "20:00", end: "08:00", color: "#6366f1" },
  ]);
  writeLS(K.seeded, true);
}

export function getStaff(): Staff[] { ensureSeed(); return readLS<Staff[]>(K.staff, []); }
export function saveStaff(s: Staff[]) { writeLS(K.staff, s); }
export function getShifts(): ShiftType[] { ensureSeed(); return readLS<ShiftType[]>(K.shifts, []); }
export function saveShifts(s: ShiftType[]) { writeLS(K.shifts, s); }

// Schedule: "date|staffId" → shiftTypeId or OFF
type Schedule = Record<string, string>;
export function getSchedule(): Schedule { ensureSeed(); return readLS<Schedule>(K.schedule, {}); }
export function shiftOn(sched: Schedule, date: string, staffId: string): string | undefined { return sched[`${date}|${staffId}`]; }
export function setShift(date: string, staffId: string, shiftId: string | "") {
  const s = getSchedule();
  if (shiftId) s[`${date}|${staffId}`] = shiftId; else delete s[`${date}|${staffId}`];
  writeLS(K.schedule, s);
}
/** Copy the 7 days starting at `fromStart` onto the week starting at `toStart`. */
export function copyWeek(fromStart: string, toStart: string) {
  const s = getSchedule();
  for (let i = 0; i < 7; i++) {
    const from = addDays(fromStart, i), to = addDays(toStart, i);
    for (const k of Object.keys(s)) if (k.startsWith(to + "|")) delete s[k];
    for (const [k, v] of Object.entries(s)) if (k.startsWith(from + "|")) s[`${to}|${k.slice(from.length + 1)}`] = v;
  }
  writeLS(K.schedule, s);
}

export function getAttendance(): Attendance[] { ensureSeed(); return readLS<Attendance[]>(K.attendance, []); }
export function saveAttendance(a: Attendance[]) { writeLS(K.attendance, a); }
export function upsertAttendance(staffId: string, date: string, patch: Partial<Attendance>) {
  const all = getAttendance();
  const i = all.findIndex((a) => a.staffId === staffId && a.date === date);
  if (i === -1) all.push({ id: newId(), staffId, date, ...patch });
  else all[i] = { ...all[i], ...patch };
  saveAttendance(all.filter((a) => a.in || a.out || a.note));
}

export function getLeaves(): Leave[] { ensureSeed(); return readLS<Leave[]>(K.leaves, []); }
export function saveLeaves(l: Leave[]) { writeLS(K.leaves, l); }
export const leaveDays = (l: Leave) => Math.round((new Date(l.to + "T00:00:00").getTime() - new Date(l.from + "T00:00:00").getTime()) / 86400000) + 1;
export const leaveOn = (leaves: Leave[], staffId: string, date: string) => leaves.find((l) => l.staffId === staffId && l.from <= date && l.to >= date);
/** Annual leave used in `year` and remaining against the yearly entitlement. */
export function leaveBalance(staffId: string, year: string, entitlement: number) {
  const used = getLeaves().filter((l) => l.staffId === staffId && l.type === "annual").reduce((s, l) => {
    // count only the days that fall inside `year`
    let n = 0;
    for (let d = l.from; d <= l.to; d = addDays(d, 1)) if (d.startsWith(year)) n++;
    return s + n;
  }, 0);
  return { used, remaining: entitlement - used };
}

export function getAdvances(): Advance[] { ensureSeed(); return readLS<Advance[]>(K.advances, []); }
export function saveAdvances(a: Advance[]) { writeLS(K.advances, a); }

export function getSettings(): RosterSettings {
  return readLS<RosterSettings>(K.settings, {
    title: "مختبر التحليلات المرضية", subtitle: "شؤون الكادر والدوام",
    footer: "النجف الأشرف - حي ميسان - مقابل بريد ميسان / 0789038080",
    graceMin: 10, annualLeaveDays: 20, weekStart: 6,
  });
}
export function saveSettings(s: RosterSettings) { writeLS(K.settings, s); }

// ── Time helpers ─────────────────────────────────────────────────────────────
export const nowHm = () => new Date().toTimeString().slice(0, 5);
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
/** Minutes between two HH:MM times (handles overnight). */
export function minutesBetween(a: string, b: string): number { let d = toMin(b) - toMin(a); if (d < 0) d += 1440; return d; }
export const hoursLabel = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
export function weekStartOf(date: string, weekStart: number): string {
  const d = new Date(date + "T00:00:00");
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(date, -diff);
}

export type DayStatus = "present" | "late" | "absent" | "leave" | "off" | "pending" | "unscheduled";
export const STATUS_LABEL: Record<DayStatus, string> = {
  present: "حاضر", late: "متأخر", absent: "غائب", leave: "إجازة", off: "راحة", pending: "لم يحضر بعد", unscheduled: "غير مجدول",
};
/** Attendance status for one staff member on one day. */
export function dayStatus(staffId: string, date: string, ctx: { sched: Schedule; shifts: ShiftType[]; att: Attendance[]; leaves: Leave[]; grace: number }): { status: DayStatus; lateMin: number; workedMin: number; shift?: ShiftType } {
  if (leaveOn(ctx.leaves, staffId, date)) return { status: "leave", lateMin: 0, workedMin: 0 };
  const sid = shiftOn(ctx.sched, date, staffId);
  const a = ctx.att.find((x) => x.staffId === staffId && x.date === date);
  const worked = a?.in && a?.out ? minutesBetween(a.in, a.out) : 0;
  if (sid === OFF) return { status: "off", lateMin: 0, workedMin: worked };
  const shift = ctx.shifts.find((s) => s.id === sid);
  if (!shift) return { status: a?.in ? "present" : "unscheduled", lateMin: 0, workedMin: worked };
  if (!a?.in) return { status: date < todayYmd() ? "absent" : "pending", lateMin: 0, workedMin: 0, shift };
  const late = minutesBetween(shift.start, a.in);
  const lateMin = late < 12 * 60 && late > ctx.grace ? late : 0; // ignore "early" arrivals wrapping past midnight
  return { status: lateMin ? "late" : "present", lateMin, workedMin: worked, shift };
}

/** Month summary for one staff member (YYYY-MM). */
export function monthSummary(staffId: string, ym: string) {
  const ctx = { sched: getSchedule(), shifts: getShifts(), att: getAttendance(), leaves: getLeaves(), grace: getSettings().graceMin };
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const s = { present: 0, late: 0, absent: 0, leave: 0, lateMin: 0, workedMin: 0 };
  for (let i = 1; i <= days; i++) {
    const d = `${ym}-${String(i).padStart(2, "0")}`;
    if (d > todayYmd()) break;
    const r = dayStatus(staffId, d, ctx);
    if (r.status === "present" || r.status === "late") s.present++;
    if (r.status === "late") { s.late++; s.lateMin += r.lateMin; }
    if (r.status === "absent") s.absent++;
    if (r.status === "leave") s.leave++;
    s.workedMin += r.workedMin;
  }
  return s;
}

// ── Backup ───────────────────────────────────────────────────────────────────
export function exportBackup() {
  return {
    app: "spir-roster", version: 1, exported_at: new Date().toISOString(),
    staff: getStaff(), shifts: getShifts(), schedule: getSchedule(), attendance: getAttendance(),
    leaves: getLeaves(), advances: getAdvances(), settings: getSettings(),
  };
}
export function importBackup(data: unknown): boolean {
  const b = data as ReturnType<typeof exportBackup>;
  if (!b || b.app !== "spir-roster" || !Array.isArray(b.staff)) return false;
  writeLS(K.staff, b.staff); writeLS(K.shifts, b.shifts ?? []); writeLS(K.schedule, b.schedule ?? {});
  writeLS(K.attendance, b.attendance ?? []); writeLS(K.leaves, b.leaves ?? []); writeLS(K.advances, b.advances ?? []);
  if (b.settings) writeLS(K.settings, b.settings);
  writeLS(K.seeded, true);
  return true;
}
