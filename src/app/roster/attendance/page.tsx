"use client";

import { useEffect, useState } from "react";
import { Clock, ChevronRight, ChevronLeft, Printer } from "lucide-react";
import {
  getStaff, getSchedule, getShifts, getAttendance, getLeaves, getSettings, dayStatus, upsertAttendance, nowHm, monthSummary, hoursLabel,
  STATUS_LABEL, type Staff, type DayStatus, type RosterSettings,
} from "@/lib/roster/store";
import { todayYmd, addDays, AR_DAYS, monthLabel } from "@/lib/local/util";
import { PrintStyle, Letterhead, PrintFooter, SignRow, exact } from "@/components/local/PrintDoc";

const inp = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand";
const TONE: Record<DayStatus, string> = {
  present: "bg-green-50 text-green-700", late: "bg-amber-50 text-amber-700", absent: "bg-red-50 text-red-700", leave: "bg-sky-50 text-sky-700",
  off: "bg-canvas text-muted", pending: "bg-amber-50 text-amber-700", unscheduled: "bg-canvas text-muted",
};

export default function AttendancePage() {
  const [date, setDate] = useState(todayYmd());
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<RosterSettings | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { setStaff(getStaff().filter((s) => s.active)); setSettings(getSettings()); }, []);
  if (!settings) return null;

  const ctx = { sched: getSchedule(), shifts: getShifts(), att: getAttendance(), leaves: getLeaves(), grace: settings.graceMin };
  void tick;
  const save = (sid: string, patch: Record<string, string | undefined>) => { upsertAttendance(sid, date, patch); setTick((t) => t + 1); };
  const summaries = staff.map((s) => ({ s, m: monthSummary(s.id, month) }));

  return (
    <div>
      <div className="no-print">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Clock className="size-6 text-brand" /> الحضور والانصراف</h1>
            <p className="mt-1 text-sm text-muted">التأخير يُحسب بعد سماحية {settings.graceMin} دقيقة من بداية المناوبة (تُغيَّر من الإعدادات).</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(addDays(date, -1))} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronRight className="size-4" /></button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inp} w-40 py-2`} />
            <button onClick={() => setDate(addDays(date, 1))} className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas"><ChevronLeft className="size-4" /></button>
            <span className="ms-2 text-sm text-muted">{AR_DAYS[new Date(date + "T00:00:00").getDay()]}</span>
          </div>
        </div>

        <div className="mb-6 overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-right text-xs text-muted">
              <tr><th className="px-3 py-2.5 font-medium">الموظف</th><th className="px-3 py-2.5 font-medium">المناوبة</th><th className="px-3 py-2.5 font-medium">الحالة</th><th className="px-3 py-2.5 font-medium">الحضور</th><th className="px-3 py-2.5 font-medium">الانصراف</th><th className="px-3 py-2.5 font-medium">الساعات</th><th className="px-3 py-2.5 font-medium">ملاحظة</th></tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const r = dayStatus(s.id, date, ctx);
                const a = ctx.att.find((x) => x.staffId === s.id && x.date === date);
                return (
                  <tr key={`${s.id}-${date}-${tick}`} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium"><span className="me-1.5 inline-block size-2.5 rounded-full" style={{ background: s.color }} />{s.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.shift ? <>{r.shift.name} <span dir="ltr">{r.shift.start}–{r.shift.end}</span></> : "—"}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}{r.lateMin ? ` ${r.lateMin} د` : ""}</span></td>
                    {(["in", "out"] as const).map((f) => (
                      <td key={f} className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input type="time" defaultValue={a?.[f] ?? ""} onBlur={(e) => save(s.id, { [f]: e.target.value || undefined })} className={`${inp} w-28`} />
                          {!a?.[f] && date === todayYmd() && <button onClick={() => save(s.id, { [f]: nowHm() })} className="rounded-md border border-line px-1.5 py-1 text-[11px] hover:bg-canvas">الآن</button>}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2 tabular-nums" dir="ltr">{r.workedMin ? hoursLabel(r.workedMin) : "—"}</td>
                    <td className="px-3 py-2"><input defaultValue={a?.note ?? ""} onBlur={(e) => save(s.id, { note: e.target.value.trim() || undefined })} className={`${inp} w-40`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {staff.length === 0 && <p className="p-6 text-center text-sm text-muted">أضف الكادر أولاً.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <b className="text-sm">الملخص الشهري</b>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inp} />
            <button onClick={() => window.print()} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer className="size-4" /> طباعة التقرير</button>
          </div>
          <SummaryTable rows={summaries} />
        </div>
      </div>

      <div className="print-doc hidden bg-white text-[12px] text-black print:block">
        <PrintStyle />
        <Letterhead title={settings.title} subtitle={settings.subtitle} color="#0369a1" right={<><div className="font-bold" style={{ color: "#0369a1" }}>تقرير الحضور الشهري</div><div>{monthLabel(month)}</div></>} />
        <div className="mt-3"><SummaryTable rows={summaries} print /></div>
        <SignRow labels={["المسؤول الإداري", "مدير المختبر"]} />
        <PrintFooter text={settings.footer} color="#0369a1" />
      </div>
    </div>
  );
}

function SummaryTable({ rows, print = false }: { rows: { s: Staff; m: ReturnType<typeof monthSummary> }[]; print?: boolean }) {
  const b = print ? "border border-gray-300" : "border-b border-line";
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className={print ? "" : "text-right text-xs text-muted"} style={print ? { background: "#f0f9ff", ...exact } : undefined}>
          {["الموظف", "أيام الحضور", "مرات التأخير", "دقائق التأخير", "الغياب", "الإجازات", "ساعات العمل"].map((h) => <th key={h} className={`${b} px-2 py-2 font-medium`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ s, m }) => (
          <tr key={s.id}>
            <td className={`${b} px-2 py-1.5 font-medium`}>{s.name}</td>
            <td className={`${b} px-2 py-1.5 text-center tabular-nums`}>{m.present}</td>
            <td className={`${b} px-2 py-1.5 text-center tabular-nums ${m.late ? "text-amber-700" : ""}`}>{m.late}</td>
            <td className={`${b} px-2 py-1.5 text-center tabular-nums`}>{m.lateMin}</td>
            <td className={`${b} px-2 py-1.5 text-center tabular-nums ${m.absent ? "font-semibold text-red-700" : ""}`}>{m.absent}</td>
            <td className={`${b} px-2 py-1.5 text-center tabular-nums`}>{m.leave}</td>
            <td className={`${b} px-2 py-1.5 text-center tabular-nums`} dir="ltr">{hoursLabel(m.workedMin)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
