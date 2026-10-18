"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { setScheduleCell } from "@/app/actions/staff";

export interface ShiftType { id: string; name: string; start: string; end: string }
export interface ScheduleStaff { id: string; name: string; role: string }

/** The lab's week, Saturday first (weekday numbers as in JavaScript: 0 = Sunday). */
export const WEEK: { day: number; label: string }[] = [
  { day: 6, label: "السبت" }, { day: 0, label: "الأحد" }, { day: 1, label: "الاثنين" }, { day: 2, label: "الثلاثاء" },
  { day: 3, label: "الأربعاء" }, { day: 4, label: "الخميس" }, { day: 5, label: "الجمعة" },
];
const TONES = ["bg-amber-50 text-amber-800", "bg-sky-50 text-sky-800", "bg-violet-50 text-violet-800", "bg-teal-50 text-brand-dark", "bg-rose-50 text-rose-800"];

/**
 * «جدول المناوبات الأسبوعي»: each person's shift on each day of the week, repeated every week. A cell
 * is a shift, «عطلة», or empty; it saves as soon as it is chosen. Under the table, how many people
 * each shift has on each day; today's column stands out. Prints as a clean table.
 */
export function ScheduleBoard({ staff, shifts, cells: initial, today, labName }: {
  staff: ScheduleStaff[]; shifts: ShiftType[]; cells: Record<string, string>; today: number; labName: string;
}) {
  const [cells, setCells] = useState(initial);
  const [, start] = useTransition();
  const key = (s: string, d: number) => `${s}:${d}`;
  const tone = (id: string) => TONES[Math.max(0, shifts.findIndex((x) => x.id === id)) % TONES.length];
  const hours = (t: ShiftType) => (t.start && t.end ? `${t.start}–${t.end}` : "");

  function set(staffId: string, day: number, value: string) {
    const k = key(staffId, day), before = cells[k] ?? "";
    setCells((c) => ({ ...c, [k]: value }));
    start(async () => {
      const r = await setScheduleCell(staffId, day, value);
      if (!r.ok) { setCells((c) => ({ ...c, [k]: before })); toast.error("تعذّر الحفظ"); }
    });
  }
  const label = (v: string) => (v === "off" ? "عطلة" : shifts.find((x) => x.id === v)?.name ?? "");
  const count = (day: number, v: string) => staff.filter((s) => cells[key(s.id, day)] === v).length;

  return (
    <div data-testid="schedule-board">
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">يتكرر الجدول كل أسبوع. اختر لكل موظف مناوبته في كل يوم، أو «عطلة» — يُحفظ فوراً.</p>
        <button type="button" onClick={() => window.print()} data-testid="schedule-print"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
          <Printer className="size-4" /> طباعة الجدول
        </button>
      </div>
      <div className="mb-2 hidden text-center print:block">
        <div className="text-lg font-bold">{labName}</div>
        <div className="text-sm">جدول المناوبات الأسبوعي</div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] print:overflow-visible print:shadow-none">
        <table className="w-full text-sm" data-testid="schedule-table">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">الموظف</th>
              {WEEK.map((w) => (
                <th key={w.day} className={`px-2 py-2.5 text-center font-medium ${w.day === today ? "bg-brand/10 text-brand-dark" : ""}`}>
                  {w.label}{w.day === today && <span className="block text-[10px]">اليوم</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">أضف الموظفين أولاً من «الكادر والبدلاء».</td></tr>}
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0" data-staff={s.name}>
                <td className="px-3 py-2 font-medium">{s.name}{s.role && <span className="block text-xs font-normal text-muted">{s.role}</span>}</td>
                {WEEK.map((w) => {
                  const v = cells[key(s.id, w.day)] ?? "";
                  return (
                    <td key={w.day} className={`px-1.5 py-1.5 text-center ${w.day === today ? "bg-brand/5" : ""}`}>
                      <select value={v} onChange={(e) => set(s.id, w.day, e.target.value)} aria-label={`${s.name} — ${w.label}`}
                        className={`no-print w-full min-w-24 rounded-lg border border-line px-1.5 py-1 text-xs ${v === "off" ? "bg-gray-100 text-muted" : v ? tone(v) : "bg-surface"}`}>
                        <option value="">—</option>
                        {shifts.map((t) => <option key={t.id} value={t.id}>{t.name}{hours(t) ? ` (${hours(t)})` : ""}</option>)}
                        <option value="off">عطلة</option>
                      </select>
                      <span className="hidden text-xs print:inline">{label(v) || "—"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {staff.length > 0 && shifts.length > 0 && (
            <tfoot className="border-t border-line bg-canvas/60 text-xs text-muted" data-testid="schedule-counts">
              {shifts.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-1.5">{t.name}{hours(t) && <span className="ms-1" dir="ltr">{hours(t)}</span>}</td>
                  {WEEK.map((w) => {
                    const n = count(w.day, t.id);
                    return <td key={w.day} className={`px-2 py-1.5 text-center tabular-nums ${n === 0 ? "text-red-600" : ""}`}>{n}</td>;
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
