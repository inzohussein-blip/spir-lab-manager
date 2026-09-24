"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Plus, Trash2, Info, Save } from "lucide-react";
import { getAnalytes, saveAnalytes, deleteAnalyte, type Analyte } from "@/lib/qc/store";
import { newId, daysUntil } from "@/lib/local/util";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand";

export default function AnalytesPage() {
  const [list, setList] = useState<Analyte[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setList(getAnalytes()); }, []);

  function update(next: Analyte[]) { setList(next); setDirty(true); setSaved(false); }
  const upd = (id: string, patch: Partial<Analyte>) => update(list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  function save() {
    saveAnalytes(list.map((a) => ({ ...a, name: a.name.trim() || "بدون اسم", levels: a.levels.map((l) => ({ ...l, mean: Number(l.mean) || 0, sd: Math.abs(Number(l.sd)) || 0 })) })));
    setList(getAnalytes()); setDirty(false); setSaved(true);
  }
  function add() {
    update([...list, { id: newId(), name: "", unit: "", device: "", active: true, levels: [{ id: newId(), label: "المستوى 1", mean: 0, sd: 1 }, { id: newId(), label: "المستوى 2", mean: 0, sd: 1 }] }]);
  }
  function remove(a: Analyte) {
    if (!window.confirm(`حذف «${a.name}» وكل قيم السيطرة المسجّلة له؟`)) return;
    deleteAnalyte(a.id);
    setList(getAnalytes());
  }

  return (
    <div className="pb-20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><SlidersHorizontal className="size-6 text-brand" /> مواد السيطرة</h1>
          <p className="mt-1 text-sm text-muted">لكل فحص: مستويات الكنترول، ورقم الـ Lot، والمتوسط والانحراف المعياري (SD) من نشرة الكنترول أو من 20 قراءة لديكم.</p>
        </div>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Plus className="size-4" /> فحص جديد</button>
      </div>

      <div className="mb-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        القيم الموجودة في البداية <b>أمثلة فقط</b> — استبدلها بقيم نشرة الكنترول المستعمل عندكم قبل الاعتماد على التنبيهات. عند تغيير الـ Lot حدّث المتوسط وSD.
      </div>

      <div className="flex flex-col gap-4">
        {list.map((a) => (
          <div key={a.id} className={`rounded-2xl border bg-surface p-4 shadow-[var(--shadow-card)] ${a.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-end">
              <label className="text-xs text-muted">اسم الفحص<input value={a.name} onChange={(e) => upd(a.id, { name: e.target.value })} className={`mt-1 ${inp} font-semibold`} /></label>
              <label className="text-xs text-muted">الوحدة<input dir="ltr" value={a.unit ?? ""} onChange={(e) => upd(a.id, { unit: e.target.value })} className={`mt-1 ${inp}`} /></label>
              <label className="text-xs text-muted">الجهاز<input value={a.device ?? ""} onChange={(e) => upd(a.id, { device: e.target.value })} className={`mt-1 ${inp}`} /></label>
              <label className="inline-flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" checked={a.active} onChange={(e) => upd(a.id, { active: e.target.checked })} className="accent-[var(--color-brand)]" /> مفعّل</label>
              <button onClick={() => remove(a)} title="حذف" className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-right text-xs text-muted"><tr><th className="pb-1 font-medium">المستوى</th><th className="pb-1 font-medium">Lot</th><th className="pb-1 font-medium">المتوسط</th><th className="pb-1 font-medium">SD</th><th className="pb-1 font-medium">الصلاحية</th><th /></tr></thead>
                <tbody>
                  {a.levels.map((l) => {
                    const updL = (patch: Partial<typeof l>) => upd(a.id, { levels: a.levels.map((x) => (x.id === l.id ? { ...x, ...patch } : x)) });
                    const exp = l.expiry ? daysUntil(l.expiry) : null;
                    return (
                      <tr key={l.id}>
                        <td className="py-1 pe-2"><input value={l.label} onChange={(e) => updL({ label: e.target.value })} className={inp} /></td>
                        <td className="py-1 pe-2"><input dir="ltr" value={l.lot ?? ""} onChange={(e) => updL({ lot: e.target.value })} className={`${inp} w-28`} /></td>
                        <td className="py-1 pe-2"><input dir="ltr" inputMode="decimal" value={String(l.mean)} onChange={(e) => updL({ mean: e.target.value as unknown as number })} className={`${inp} w-24`} /></td>
                        <td className="py-1 pe-2"><input dir="ltr" inputMode="decimal" value={String(l.sd)} onChange={(e) => updL({ sd: e.target.value as unknown as number })} className={`${inp} w-20`} /></td>
                        <td className="py-1 pe-2">
                          <input type="date" value={l.expiry ?? ""} onChange={(e) => updL({ expiry: e.target.value || undefined })} className={`${inp} w-36 ${exp != null && exp < 0 ? "!border-red-400 text-red-700" : exp != null && exp <= 30 ? "!border-amber-400" : ""}`} />
                        </td>
                        <td className="py-1"><button onClick={() => upd(a.id, { levels: a.levels.filter((x) => x.id !== l.id) })} title="حذف المستوى" className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={() => upd(a.id, { levels: [...a.levels, { id: newId(), label: `المستوى ${a.levels.length + 1}`, mean: 0, sd: 1 }] })} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> مستوى</button>
          </div>
        ))}
      </div>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:start-72">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {saved && <span className="text-xs text-green-700">تم الحفظ.</span>}
          {dirty && <span className="text-xs text-amber-700">تغييرات غير محفوظة</span>}
          <button onClick={save} disabled={!dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Save className="size-4" /> حفظ</button>
        </div>
      </div>
    </div>
  );
}
