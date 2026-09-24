"use client";

import { useEffect, useState } from "react";
import { Plane, Plus, Trash2 } from "lucide-react";
import { getStaff, getLeaves, saveLeaves, getSettings, leaveDays, leaveBalance, LEAVE_TYPES, type Leave, type LeaveType, type Staff } from "@/lib/roster/store";
import { newId, todayYmd } from "@/lib/local/util";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function LeavesPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [list, setList] = useState<Leave[]>([]);
  const [ent, setEnt] = useState(20);
  const [f, setF] = useState({ staffId: "", type: "annual" as LeaveType, from: todayYmd(), to: todayYmd(), note: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = getStaff().filter((x) => x.active); setStaff(s); setList(getLeaves()); setEnt(getSettings().annualLeaveDays);
    setF((cur) => ({ ...cur, staffId: s[0]?.id ?? "" }));
  }, []);

  function persist(next: Leave[]) { setList(next); saveLeaves(next); }
  function add() {
    if (!f.staffId) { setErr("اختر الموظف."); return; }
    if (f.to < f.from) { setErr("تاريخ النهاية قبل البداية."); return; }
    const overlap = list.some((l) => l.staffId === f.staffId && l.from <= f.to && l.to >= f.from);
    if (overlap && !window.confirm("توجد إجازة متداخلة لهذا الموظف في الفترة نفسها. إضافة رغم ذلك؟")) return;
    persist([...list, { id: newId(), staffId: f.staffId, type: f.type, from: f.from, to: f.to, ...(f.note.trim() ? { note: f.note.trim() } : {}) }]);
    setErr(""); setF({ ...f, note: "" });
  }
  const name = (id: string) => getStaff().find((s) => s.id === id)?.name ?? "—";
  const year = todayYmd().slice(0, 4);
  const days = f.to >= f.from ? leaveDays({ from: f.from, to: f.to } as Leave) : 0;

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><Plane className="size-6 text-brand" /> الإجازات</h1>
      <p className="mb-5 text-sm text-muted">الإجازة تظهر تلقائياً في الجدول وتُحتسب في الحضور. رصيد الإجازة السنوية: {ent} يوماً (يُغيَّر من الإعدادات).</p>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium">الموظف<select value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })} className={`mt-1 ${inp}`}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-sm font-medium">النوع<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as LeaveType })} className={`mt-1 ${inp}`}>{Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm font-medium">من<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">إلى<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">ملاحظة<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={`mt-1 ${inp}`} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={add} disabled={!staff.length} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> تسجيل إجازة ({days} يوم)</button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="mb-2 text-sm font-bold">سجل الإجازات</div>
          {list.length === 0 ? <p className="text-sm text-muted">لا إجازات مسجّلة.</p> : (
            <div className="flex flex-col gap-1.5">
              {[...list].sort((a, b) => b.from.localeCompare(a.from)).map((l) => (
                <div key={l.id} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${l.to < todayYmd() ? "bg-canvas text-muted" : "border border-line"}`}>
                  <b className="min-w-28">{name(l.staffId)}</b>
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">{LEAVE_TYPES[l.type]}</span>
                  <span dir="ltr" className="text-xs">{l.from} → {l.to}</span>
                  <span className="text-xs">({leaveDays(l)} يوم)</span>
                  {l.note && <span className="text-xs text-muted">— {l.note}</span>}
                  <button onClick={() => window.confirm("حذف هذه الإجازة؟") && persist(list.filter((x) => x.id !== l.id))} className="ms-auto grid size-7 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="mb-2 text-sm font-bold">رصيد الإجازة السنوية {year}</div>
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-muted"><tr><th className="pb-1 font-medium">الموظف</th><th className="pb-1 text-center font-medium">المستخدم</th><th className="pb-1 text-center font-medium">المتبقي</th></tr></thead>
            <tbody>
              {staff.map((s) => { const b = leaveBalance(s.id, year, ent); return (
                <tr key={s.id} className="border-t border-line"><td className="py-1.5">{s.name}</td><td className="py-1.5 text-center tabular-nums">{b.used}</td><td className={`py-1.5 text-center font-semibold tabular-nums ${b.remaining < 0 ? "text-red-600" : b.remaining <= 3 ? "text-amber-600" : "text-green-700"}`}>{b.remaining}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
