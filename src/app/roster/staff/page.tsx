"use client";

import { useEffect, useState } from "react";
import { UserCog, Plus, Pencil, Trash2, X, Phone } from "lucide-react";
import { getStaff, saveStaff, STAFF_COLORS, type Staff } from "@/lib/roster/store";
import { newId } from "@/lib/local/util";
import { money, CURRENCY } from "@/lib/utils";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const empty = { name: "", role: "", phone: "", hireDate: "", salary: "", color: STAFF_COLORS[0], active: true };

export default function StaffPage() {
  const [list, setList] = useState<Staff[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { setList(getStaff()); }, []);
  function persist(next: Staff[]) { setList(next); saveStaff(next); }
  function reset() { setF({ ...empty, color: STAFF_COLORS[list.length % STAFF_COLORS.length] }); setEditId(null); }
  function submit() {
    if (!f.name.trim()) return;
    const rec: Staff = {
      id: editId ?? newId(), name: f.name.trim(), role: f.role.trim() || undefined, phone: f.phone.trim() || undefined,
      hireDate: f.hireDate || undefined, salary: f.salary ? Number(f.salary) : undefined, color: f.color, active: f.active,
    };
    persist(editId ? list.map((x) => (x.id === editId ? rec : x)) : [...list, rec]);
    setF({ ...empty, color: STAFF_COLORS[(list.length + 1) % STAFF_COLORS.length] }); setEditId(null);
  }
  function edit(s: Staff) {
    setF({ name: s.name, role: s.role ?? "", phone: s.phone ?? "", hireDate: s.hireDate ?? "", salary: s.salary ? String(s.salary) : "", color: s.color, active: s.active });
    setEditId(s.id); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold"><UserCog className="size-6 text-brand" /> الكادر</h1>
      <p className="mb-5 text-sm text-muted">الموظفون ووظائفهم ورواتبهم الأساسية. الموظف غير الفعّال يختفي من الجدول والحضور ويبقى سجله.</p>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{editId ? "تعديل موظف" : "إضافة موظف"}</div>
          {editId && <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="size-3.5" /> إلغاء</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">الاسم *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الوظيفة<input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="محلل، سحب دم، استقبال…" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الهاتف<input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">تاريخ التعيين<input type="date" value={f.hireDate} onChange={(e) => setF({ ...f, hireDate: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الراتب الأساسي ({CURRENCY})<input inputMode="numeric" dir="ltr" value={f.salary} onChange={(e) => setF({ ...f, salary: e.target.value.replace(/[^\d]/g, "") })} className={`mt-1 ${inp}`} /></label>
          <div className="text-sm font-medium">اللون في الجدول
            <div className="mt-2 flex gap-1.5">{STAFF_COLORS.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, color: c })} className={`size-6 rounded-full ${f.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />)}</div>
          </div>
          <label className="inline-flex items-center gap-1.5 self-end pb-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-[var(--color-brand)]" /> فعّال</label>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة"}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <div key={s.id} className={`flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] ${s.active ? "" : "opacity-60"}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: s.color }}>{s.name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold">{s.name} {!s.active && <span className="text-xs font-normal text-muted">(غير فعّال)</span>}</div>
                  <div className="text-xs text-muted">{s.role ?? "—"}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => edit(s)} title="تعديل" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-3.5" /></button>
                  <button onClick={() => window.confirm(`حذف «${s.name}»؟ يبقى سجل حضوره محفوظاً.`) && persist(list.filter((x) => x.id !== s.id))} title="حذف" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {s.phone && <span className="inline-flex items-center gap-1" dir="ltr"><Phone className="size-3" />{s.phone}</span>}
                {s.hireDate && <span>التعيين: <span dir="ltr">{s.hireDate}</span></span>}
                {s.salary ? <span>الراتب: <b className="text-ink">{money(s.salary)}</b> {CURRENCY}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
