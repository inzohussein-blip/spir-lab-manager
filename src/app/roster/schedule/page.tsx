"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, ChevronLeft, Copy, Printer, Settings2, Plus, Trash2 } from "lucide-react";
import {
  getStaff, getShifts, saveShifts, getSchedule, setShift, copyWeek, getSettings, weekStartOf, shiftOn, getLeaves, leaveOn, OFF,
  type Staff, type ShiftType, type RosterSettings,
} from "@/lib/roster/store";
import { todayYmd, addDays, AR_DAYS, newId } from "@/lib/local/util";
import { PrintStyle, Letterhead, PrintFooter, exact } from "@/components/local/PrintDoc";

const inp = "w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand";

export default function SchedulePage() {
  const [settings, setSettings] = useState<RosterSettings | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [sched, setSched] = useState<Record<string, string>>({});
  const [start, setStart] = useState("");
  const [manage, setManage] = useState(false);

  useEffect(() => {
    const s = getSettings(); setSettings(s);
    setStaff(getStaff().filter((x) => x.active)); setShifts(getShifts()); setSched(getSchedule());
    setStart(weekStartOf(todayYmd(), s.weekStart));
  }, []);
  if (!settings || !start) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const leaves = getLeaves();
  const reload = () => setSched(getSchedule());
  function set(d: string, sid: string, v: string) { setShift(d, sid, v); reload(); }
  function copyPrev() {
    if (!window.confirm("نسخ جدول الأسبوع السابق إلى هذا الأسبوع؟ سيُستبدل ما هو موجود.")) return;
    copyWeek(addDays(start, -7), start); reload();
  }
  function persistShifts(next: ShiftType[]) { setShifts(next); saveShifts(next); }
  const shiftOf = (id?: string) => shifts.find((s) => s.id === id);

  const grid = (print: boolean) => (
    <table className={`w-full border-collapse ${print ? "text-[11px]" : "min-w-[760px] text-sm"}`}>
      <thead>
        <tr>
          <th className={`border px-2 py-2 text-right ${print ? "border-gray-300" : "border-line bg-canvas"}`} style={print ? { background: "#f0f9ff", ...exact } : undefined}>الموظف</th>
          {days.map((d) => (
            <th key={d} className={`border px-1 py-2 ${print ? "border-gray-300" : "border-line bg-canvas"} ${d === todayYmd() && !print ? "!bg-brand-light text-brand-dark" : ""}`} style={print ? { background: "#f0f9ff", ...exact } : undefined}>
              {AR_DAYS[new Date(d + "T00:00:00").getDay()]}<div className="text-[10px] font-normal text-muted" dir="ltr">{d.slice(5)}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {staff.map((s) => (
          <tr key={s.id}>
            <td className={`border px-2 py-1.5 font-medium ${print ? "border-gray-300" : "border-line"}`}><span className="me-1.5 inline-block size-2.5 rounded-full" style={{ background: s.color, ...exact }} />{s.name}</td>
            {days.map((d) => {
              const v = shiftOn(sched, d, s.id);
              const sh = shiftOf(v);
              const onLeave = leaveOn(leaves, s.id, d);
              if (print) return (
                <td key={d} className="border border-gray-300 px-1 py-1.5 text-center" style={sh ? { background: sh.color + "22", ...exact } : undefined}>
                  {onLeave ? "إجازة" : v === OFF ? "راحة" : sh ? <><b>{sh.name}</b><div className="text-[9px]" dir="ltr">{sh.start}–{sh.end}</div></> : ""}
                </td>
              );
              return (
                <td key={d} className="border border-line p-1">
                  {onLeave ? <div className="rounded-md bg-sky-50 px-2 py-1.5 text-center text-xs font-semibold text-sky-700">إجازة</div> : (
                    <select value={v ?? ""} onChange={(e) => set(d, s.id, e.target.value)}
                      className="w-full rounded-md border-0 px-1.5 py-1.5 text-xs font-semibold outline-none"
                      style={{ background: sh ? sh.color + "26" : v === OFF ? "var(--color-canvas)" : "transparent", color: sh ? sh.color : undefined }}>
                      <option value="">—</option>
                      {shifts.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.start}–{x.end})</option>)}
                      <option value={OFF}>راحة</option>
                    </select>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarDays className="size-6 text-brand" /> جدول المناوبات</h1>
            <p className="mt-1 text-sm text-muted">اختر المناوبة لكل موظف في كل يوم. الإجازات المسجّلة تظهر تلقائياً.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setStart(addDays(start, -7))} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronRight className="size-4" /></button>
            <span className="text-sm font-semibold" dir="ltr">{start} → {addDays(start, 6)}</span>
            <button onClick={() => setStart(addDays(start, 7))} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronLeft className="size-4" /></button>
            <button onClick={() => setStart(weekStartOf(todayYmd(), settings.weekStart))} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">هذا الأسبوع</button>
            <button onClick={copyPrev} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Copy className="size-4" /> نسخ الأسبوع السابق</button>
            <button onClick={() => setManage((m) => !m)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Settings2 className="size-4" /> المناوبات</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer className="size-4" /> طباعة</button>
          </div>
        </div>

        {manage && (
          <div className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="mb-2 text-sm font-bold">أنواع المناوبات</div>
            <div className="flex flex-col gap-2">
              {shifts.map((x) => (
                <div key={x.id} className="grid grid-cols-[2fr_1fr_1fr_auto_auto] items-center gap-2">
                  <input value={x.name} onChange={(e) => persistShifts(shifts.map((y) => (y.id === x.id ? { ...y, name: e.target.value } : y)))} className={inp} />
                  <input type="time" value={x.start} onChange={(e) => persistShifts(shifts.map((y) => (y.id === x.id ? { ...y, start: e.target.value } : y)))} className={inp} />
                  <input type="time" value={x.end} onChange={(e) => persistShifts(shifts.map((y) => (y.id === x.id ? { ...y, end: e.target.value } : y)))} className={inp} />
                  <input type="color" value={x.color} onChange={(e) => persistShifts(shifts.map((y) => (y.id === x.id ? { ...y, color: e.target.value } : y)))} className="h-8 w-10 cursor-pointer rounded border border-line" />
                  <button onClick={() => window.confirm(`حذف «${x.name}»؟`) && persistShifts(shifts.filter((y) => y.id !== x.id))} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <button onClick={() => persistShifts([...shifts, { id: newId(), name: "مناوبة جديدة", start: "08:00", end: "16:00", color: "#10b981" }])} className="inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> مناوبة</button>
            </div>
          </div>
        )}

        {staff.length === 0 ? <p className="text-sm text-muted">أضف الكادر أولاً من صفحة «الكادر».</p> : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">{grid(false)}</div>
        )}
      </div>

      <div className="print-doc hidden bg-white text-black print:block">
        <PrintStyle landscape />
        <Letterhead title={settings.title} subtitle={settings.subtitle} color="#0369a1" right={<><div className="font-bold" style={{ color: "#0369a1" }}>جدول المناوبات الأسبوعي</div><div dir="ltr">{start} → {addDays(start, 6)}</div></>} />
        <div className="mt-3">{grid(true)}</div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">{shifts.map((x) => <span key={x.id}><span className="me-1 inline-block size-2.5 rounded-sm" style={{ background: x.color, ...exact }} />{x.name} <span dir="ltr">{x.start}–{x.end}</span></span>)}</div>
        <PrintFooter text={settings.footer} color="#0369a1" />
      </div>
    </div>
  );
}
