"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Plus, Trash2, Pencil, X, AlertTriangle, CalendarClock } from "lucide-react";
import {
  getStock, saveStock, getTests, daysToExpiry, uid,
  type StockItem, type StationTest,
} from "@/lib/station/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const empty = { name: "", qty: "", minQty: "", expiry: "", linkedTestId: "" };

function Tile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const c = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-brand-dark";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

export default function InventoryPage() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { setRows(getStock()); setTests(getTests()); }, []);

  function persist(next: StockItem[]) { setRows(next); saveStock(next); }
  function reset() { setF({ ...empty }); setEditId(null); }

  function submit() {
    if (!f.name.trim()) return;
    const rec: StockItem = {
      id: editId ?? uid(),
      name: f.name.trim(),
      qty: Number(f.qty) || 0,
      minQty: f.minQty.trim() ? Number(f.minQty) : undefined,
      expiry: f.expiry || undefined,
      linkedTestId: f.linkedTestId || undefined,
    };
    persist(editId ? rows.map((r) => (r.id === editId ? rec : r)) : [...rows, rec]);
    reset();
  }
  function edit(s: StockItem) {
    setF({ name: s.name, qty: String(s.qty), minQty: s.minQty != null ? String(s.minQty) : "", expiry: s.expiry ?? "", linkedTestId: s.linkedTestId ?? "" });
    setEditId(s.id);
  }
  function del(id: string) {
    if (!window.confirm("حذف هذا الصنف؟")) return;
    persist(rows.filter((r) => r.id !== id));
    if (editId === id) reset();
  }
  function restock(id: string, amount: number) {
    persist(rows.map((r) => (r.id === id ? { ...r, qty: Math.max(0, Number(r.qty) + amount) } : r)));
  }

  const isLow = (s: StockItem) => s.minQty != null && Number(s.qty) <= Number(s.minQty);
  const testName = (id?: string) => tests.find((t) => t.id === id)?.name_ar;

  const { lowCount, soonCount } = useMemo(() => {
    let low = 0, soon = 0;
    for (const s of rows) {
      if (isLow(s)) low++;
      const d = daysToExpiry(s.expiry);
      if (d != null && d <= 30) soon++;
    }
    return { lowCount: low, soonCount: soon };
  }, [rows]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Boxes className="size-6" /> المخزن</h1>
        <p className="mt-1 text-sm text-muted">أصناف المختبر (كواشف/عُدد) بكمياتها وتواريخ انتهائها. تُحسم عيّنة تلقائياً عند إدخال فحص مرتبط بها.</p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Tile label="عدد الأصناف" value={rows.length} />
        <Tile label="تحت الحد الأدنى" value={lowCount} tone={lowCount ? "danger" : undefined} />
        <Tile label="قرب/منتهي الصلاحية" value={soonCount} tone={soonCount ? "warn" : undefined} />
      </div>

      {/* Add / edit */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{editId ? "تعديل صنف" : "إضافة صنف"}</div>
          {editId && <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="size-3.5" /> إلغاء</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">اسم الصنف *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الكمية<input type="number" step="any" min="0" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الحد الأدنى للتنبيه<input type="number" step="any" min="0" value={f.minQty} onChange={(e) => setF({ ...f, minQty: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">تاريخ الانتهاء<input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium sm:col-span-2 lg:col-span-1">مرتبط بفحص (يُحسم عند إدخاله)
            <select value={f.linkedTestId} onChange={(e) => setF({ ...f, linkedTestId: e.target.value })} className={`mt-1 ${inp}`}>
              <option value="">— بدون ربط —</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
            </select>
          </label>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          <Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة"}
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الصنف</th>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium">مرتبط بفحص</th>
              <th className="px-4 py-3 font-medium">الانتهاء</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">تعبئة</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">لا أصناف بعد</td></tr>}
            {rows.map((s) => {
              const d = daysToExpiry(s.expiry);
              const expired = d != null && d < 0;
              const soon = d != null && d >= 0 && d <= 30;
              const low = isLow(s);
              return (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className={`px-4 py-3 tabular-nums ${low ? "font-bold text-red-600" : ""}`}>{s.qty}</td>
                  <td className="px-4 py-3 text-muted">{testName(s.linkedTestId) ?? "—"}</td>
                  <td className={`px-4 py-3 ${expired ? "text-red-600" : soon ? "text-amber-700" : "text-muted"}`}>{s.expiry ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {low && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"><AlertTriangle className="size-3" /> نقص</span>}
                      {expired && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">منتهي</span>}
                      {soon && !expired && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><CalendarClock className="size-3" /> {d} يوم</span>}
                      {!low && !expired && !soon && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-brand-dark">جيد</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => restock(s.id, 1)} className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas" title="+1"><Plus className="size-4" /></button>
                      <button onClick={() => restock(s.id, 10)} className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas">+10</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => edit(s)} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                      <button onClick={() => del(s.id)} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
