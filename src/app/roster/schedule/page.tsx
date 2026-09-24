"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, ChevronLeft, Copy, Printer, Settings2, Plus, Trash2, UserRoundCheck, X } from "lucide-react";
import {
  getStaff, getShifts, saveShifts, getSchedule, setShift, copyWeek, getSettings, weekStartOf, shiftOn, getLeaves, leaveOn, OFF,
  getSubs, setSub, subFor, coverOf, type Staff, type ShiftType, type RosterSettings, type Subs,
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
  const [subs, setSubs] = useState<Subs>({});
  const [editing, setEditing] = useState<{ date: string; staffId: string } | null>(null);

  useEffect(() => {
    const s = getSettings(); setSettings(s);
    setStaff(getStaff().filter((x) => x.active)); setShifts(getShifts()); setSched(getSchedule()); setSubs(getSubs());
    setStart(weekStartOf(todayYmd(), s.weekStart));
  }, []);
  if (!settings || !start) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const leaves = getLeaves();
  const reload = () => { setSched(getSchedule()); setSubs(getSubs()); };
  function set(d: string, sid: string, v: string) { setShift(d, sid, v); reload(); }
  function copyPrev() {
    if (!window.confirm("نسخ جدول الأسبوع السابق إلى هذا الأسبوع؟ سيُستبدل ما هو موجود.")) return;
    copyWeek(addDays(start, -7), start); reload();
  }
  function persistShifts(next: ShiftType[]) { setShifts(next); saveShifts(next); }
  const shiftOf = (id?: string) => shifts.find((s) => s.id === id);
  const nameOf = (id?: string) => staff.find((x) => x.id === id)?.name ?? "—";

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
              const sub = subFor(subs, d, s.id);
              const cov = coverOf(subs, sched, d, s.id);
              const covShift = shiftOf(cov?.shiftId);
              if (print) return (
                <td key={d} className="border border-gray-300 px-1 py-1.5 text-center" style={sh ? { background: sh.color + "22", ...exact } : undefined}>
                  {onLeave ? "إجازة" : v === OFF ? "راحة" : sh ? <><b>{sh.name}</b><div className="text-[9px]" dir="ltr">{sh.start}–{sh.end}</div></> : ""}
                  {sub && <div className="text-[9px] font-bold" style={{ color: "#6d28d9" }}>البديل: {nameOf(sub.by)}</div>}
                  {cov && <div className="text-[9px] font-bold" style={{ color: "#6d28d9" }}>بديل عن {nameOf(cov.forId)}{covShift && !sh ? ` · ${covShift.name}` : ""}</div>}
                </td>
              );
              return (
                <td key={d} className="group border border-line p-1 align-top">
                  {onLeave ? <div className="rounded-md bg-sky-50 px-2 py-1.5 text-center text-xs font-semibold text-sky-700">إجازة</div> : (
                    <select value={v ?? ""} onChange={(e) => set(d, s.id, e.target.value)}
                      className="w-full rounded-md border-0 px-1.5 py-1.5 text-xs font-semibold outline-none"
                      style={{ background: sh ? sh.color + "26" : v === OFF ? "var(--color-canvas)" : "transparent", color: sh ? sh.color : undefined }}>
                      <option value="">—</option>
                      {shifts.map((x) => <option key={x.id} value={x.id}>{x.name} ({"\u2066"}{x.start}–{x.end}{"\u2069"})</option>)}
                      <option value={OFF}>راحة</option>
                    </select>
                  )}
                  {sub ? (
                    <button onClick={() => setEditing({ date: d, staffId: s.id })} title={sub.note || "تعديل البديل"}
                      className="mt-1 flex w-full items-center gap-1 truncate rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100">
                      <UserRoundCheck className="size-3 shrink-0" /> البديل: {nameOf(sub.by)}
                    </button>
                  ) : (onLeave || sh) && (
                    <button onClick={() => setEditing({ date: d, staffId: s.id })}
                      className={`mt-1 w-full rounded-md px-1.5 py-0.5 text-[10px] text-muted hover:bg-canvas hover:text-violet-700 focus:opacity-100 ${onLeave ? "" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"}`}>
                      + بديل
                    </button>
                  )}
                  {cov && (
                    <div title={subFor(subs, d, cov.forId)?.note} className="mt-1 truncate rounded-md border border-dashed border-violet-300 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                      بديل عن {nameOf(cov.forId)}{covShift && !sh ? ` · ${covShift.name}` : ""}
                    </div>
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
            <p className="mt-1 text-sm text-muted">اختر المناوبة لكل موظف في كل يوم. الإجازات تظهر تلقائياً، و«+ بديل» يعيّن من يغطي مناوبة موظف غائب أو مُجاز.</p>
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

      {editing && (
        <SubDialog
          date={editing.date} person={staff.find((x) => x.id === editing.staffId)!} staff={staff} shifts={shifts} sched={sched} leaves={leaves}
          current={subFor(subs, editing.date, editing.staffId)}
          onSave={(v) => { setSub(editing.date, editing.staffId, v); setSubs(getSubs()); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

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

function SubDialog({ date, person, staff, shifts, sched, leaves, current, onSave, onClose }: {
  date: string; person: Staff; staff: Staff[]; shifts: ShiftType[]; sched: Record<string, string>; leaves: ReturnType<typeof getLeaves>;
  current?: { by: string; shiftId?: string; note?: string }; onSave: (v: { by: string; shiftId?: string; note?: string } | null) => void; onClose: () => void;
}) {
  const own = shiftOn(sched, date, person.id);
  const [by, setBy] = useState(current?.by ?? "");
  const [shiftId, setShiftId] = useState(current?.shiftId ?? (own && own !== OFF ? own : shifts[0]?.id ?? ""));
  const [note, setNote] = useState(current?.note ?? "");
  const candidates = staff.filter((x) => x.id !== person.id && !leaveOn(leaves, x.id, date));
  const theirs = (id: string) => { const v = shiftOn(sched, date, id); return v === OFF ? "راحة" : shifts.find((x) => x.id === v)?.name; };
  const clash = by && shiftOn(sched, date, by) === shiftId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="تعيين بديل">
        <div className="mb-1 flex items-center justify-between">
          <b className="flex items-center gap-2"><UserRoundCheck className="size-5 text-violet-600" /> بديل لـ {person.name}</b>
          <button onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <p className="mb-4 text-xs text-muted">{AR_DAYS[new Date(date + "T00:00:00").getDay()]} <span dir="ltr">{date}</span>{leaveOn(leaves, person.id, date) ? " — في إجازة" : ""}</p>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted">الموظف البديل
            <select value={by} onChange={(e) => setBy(e.target.value)} className={`mt-1 ${inp}`}>
              <option value="">— اختر —</option>
              {candidates.map((x) => <option key={x.id} value={x.id}>{x.name}{theirs(x.id) ? ` (${theirs(x.id)})` : ""}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">المناوبة التي يغطيها
            <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={`mt-1 ${inp}`}>
              {shifts.map((x) => <option key={x.id} value={x.id}>{x.name} ({"\u2066"}{x.start}–{x.end}{"\u2069"})</option>)}
            </select>
          </label>
          {clash && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">البديل لديه نفس المناوبة في هذا اليوم.</p>}
          <label className="text-xs text-muted">ملاحظة (اختياري)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب الاستبدال، اتفاق التعويض…" className={`mt-1 ${inp}`} />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button disabled={!by || !shiftId} onClick={() => onSave({ by, shiftId, ...(note.trim() ? { note: note.trim() } : {}) })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">حفظ</button>
          {current && <button onClick={() => onSave(null)} className="rounded-lg border border-line px-3 py-2 text-sm text-red-600 hover:bg-red-50">إزالة البديل</button>}
          <button onClick={onClose} className="ms-auto rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
