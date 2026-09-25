"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogIn, LogOut, Plane, Wallet, UserPlus } from "lucide-react";
import {
  getStaff, getAdvances, rosterCtx, dayStatus, upsertAttendance, nowHm,
  STATUS_LABEL, LEAVE_TYPES, leaveDays, type Staff, type DayStatus,
} from "@/lib/roster/store";
import { todayYmd, addDays, AR_DAYS } from "@/lib/local/util";
import { money, CURRENCY } from "@/lib/utils";

const TONE: Record<DayStatus, string> = {
  present: "bg-green-50 text-green-700", late: "bg-amber-50 text-amber-700", absent: "bg-red-50 text-red-700", leave: "bg-sky-50 text-sky-700",
  off: "bg-canvas text-muted", pending: "bg-amber-50 text-amber-700", unscheduled: "bg-canvas text-muted", replaced: "bg-violet-50 text-violet-700",
};

export default function RosterDashboard() {
  const [tick, setTick] = useState(0);
  const [staff, setStaff] = useState<Staff[]>([]);
  // Today is read in the browser, so a page saved for offline use never shows a stale day.
  const [d, setD] = useState("");
  useEffect(() => { setStaff(getStaff().filter((s) => s.active)); setD(todayYmd()); }, [tick]);
  if (!d) return null;

  const ctx = rosterCtx();
  const nameOf = (id?: string) => staff.find((x) => x.id === id)?.name ?? getStaff().find((x) => x.id === id)?.name ?? "—";
  const rows = staff.map((s) => ({ s, r: dayStatus(s.id, d, ctx), a: ctx.att.find((x) => x.staffId === s.id && x.date === d) }))
    .sort((x, y) => (x.r.shift?.start ?? "99").localeCompare(y.r.shift?.start ?? "99"));
  const upcoming = ctx.leaves.filter((l) => l.to >= d && l.from <= addDays(d, 14)).sort((a, b) => a.from.localeCompare(b.from));
  const ym = d.slice(0, 7);
  const adv = getAdvances().filter((a) => a.deductMonth === ym).reduce((s, a) => s + a.amount, 0);

  function punch(staffId: string, field: "in" | "out") { upsertAttendance(staffId, d, { [field]: nowHm() }); setTick((t) => t + 1); }

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><LayoutDashboard className="size-6 text-brand" /> لوحة الدوام</h1>
      <p className="mb-5 text-sm text-muted">{AR_DAYS[new Date(d + "T00:00:00").getDay()]} <span dir="ltr">{d}</span> — تسجيل الحضور والانصراف بضغطة.</p>

      {staff.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">لا يوجد موظفون بعد.</p>
          <Link href="/roster/staff" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><UserPlus className="size-4" /> إضافة الكادر</Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-col divide-y divide-line">
              {rows.map(({ s, r, a }) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="size-3 rounded-full" style={{ background: s.color }} />
                  <div className="min-w-32 flex-1">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted">{s.role ?? ""}{r.shift && <> · {r.shift.name} <span dir="ltr">{r.shift.start}–{r.shift.end}</span></>}</div>
                    {r.covering && <div className="mt-0.5 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">بديل عن {nameOf(r.covering.forId)}{r.covering.shift ? ` · ${r.covering.shift.name}` : ""}</div>}
                    {r.coveredBy && <div className="mt-0.5 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">البديل: {nameOf(r.coveredBy)}</div>}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}{r.lateMin ? ` ${r.lateMin} د` : ""}</span>
                  {r.status !== "leave" && r.status !== "off" && r.status !== "replaced" && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {a?.in ? <span className="rounded-lg bg-canvas px-2 py-1" dir="ltr">↘ {a.in}</span> : (
                        <button onClick={() => punch(s.id, "in")} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 font-semibold text-white hover:bg-brand-dark"><LogIn className="size-3.5" /> حضور</button>
                      )}
                      {a?.in && (a?.out ? <span className="rounded-lg bg-canvas px-2 py-1" dir="ltr">↗ {a.out}</span> : (
                        <button onClick={() => punch(s.id, "out")} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 font-semibold hover:bg-canvas"><LogOut className="size-3.5" /> انصراف</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Plane className="size-4 text-brand" /> الإجازات (14 يوماً)</div>
              {upcoming.length === 0 ? <p className="text-xs text-muted">لا إجازات قادمة.</p> : upcoming.map((l) => (
                <div key={l.id} className="mb-1.5 rounded-lg bg-canvas px-3 py-1.5 text-xs">
                  <b>{getStaff().find((s) => s.id === l.staffId)?.name ?? "—"}</b> — {LEAVE_TYPES[l.type]} ({leaveDays(l)} يوم)
                  <div className="text-muted" dir="ltr">{l.from} → {l.to}</div>
                </div>
              ))}
            </div>
            <Link href="/roster/payroll" className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-brand">
              <div className="flex items-center gap-2 text-sm font-bold"><Wallet className="size-4 text-brand" /> سلف تُخصم هذا الشهر</div>
              <div className="mt-1 text-xl font-extrabold tabular-nums">{money(adv)} <span className="text-sm font-normal">{CURRENCY}</span></div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
