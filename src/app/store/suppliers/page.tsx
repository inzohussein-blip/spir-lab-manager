"use client";

import { useEffect, useState } from "react";
import { Truck, Plus, Trash2, Pencil, X } from "lucide-react";
import { getSuppliers, saveSuppliers, uid, type Supplier } from "@/lib/purchasing/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const empty = { name: "", phone: "", note: "" };

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { setRows(getSuppliers()); }, []);

  function persist(next: Supplier[]) { setRows(next); saveSuppliers(next); }
  function reset() { setF({ ...empty }); setEditId(null); }

  function submit() {
    if (!f.name.trim()) return;
    const rec: Supplier = { id: editId ?? uid(), name: f.name.trim(), phone: f.phone.trim() || undefined, note: f.note.trim() || undefined };
    persist(editId ? rows.map((r) => (r.id === editId ? rec : r)) : [...rows, rec]);
    reset();
  }
  function edit(s: Supplier) { setF({ name: s.name, phone: s.phone ?? "", note: s.note ?? "" }); setEditId(s.id); }
  function del(id: string) {
    if (!window.confirm("حذف هذا المورّد؟")) return;
    persist(rows.filter((r) => r.id !== id));
    if (editId === id) reset();
  }

  return (
    <div>
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Truck className="size-6" /> الموردون</h1>

      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{editId ? "تعديل مورّد" : "إضافة مورّد"}</div>
          {editId && <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="size-3.5" /> إلغاء</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">الاسم *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الهاتف<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">ملاحظة<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={`mt-1 ${inp}`} /></label>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          <Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">المورّد</th>
              <th className="px-4 py-3 font-medium">الهاتف</th>
              <th className="px-4 py-3 font-medium">ملاحظة</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">لا موردين بعد</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{s.note ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => edit(s)} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                    <button onClick={() => del(s.id)} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
