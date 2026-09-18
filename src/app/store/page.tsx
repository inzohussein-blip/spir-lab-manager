"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart, Plus, Trash2, Search, Coins, Wallet, X,
} from "lucide-react";
import {
  getPurchases, addPurchase, deletePurchases, getSuppliers, purchaseTotal, uid,
  type Purchase, type PurchaseItem, type Supplier,
} from "@/lib/purchasing/store";
import { money } from "@/lib/utils";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const today = () => new Date().toISOString().slice(0, 10);

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === "danger" ? "text-red-600" : "text-amber-700"}`}>{value}</div>
    </div>
  );
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Add form
  const [date, setDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([{ name: "", qty: 1, unitPrice: 0 }]);

  useEffect(() => { setPurchases(getPurchases()); setSuppliers(getSuppliers()); }, []);

  const total = purchaseTotal(items);

  function setItem(i: number, patch: Partial<PurchaseItem>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() { setItems((a) => [...a, { name: "", qty: 1, unitPrice: 0 }]); }
  function removeRow(i: number) { setItems((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : a)); }

  function resetForm() {
    setDate(today()); setSupplierId(""); setSupplierName(""); setPaid(false); setNotes("");
    setItems([{ name: "", qty: 1, unitPrice: 0 }]);
  }

  function save() {
    const clean = items.filter((it) => it.name.trim() !== "");
    if (clean.length === 0) { alert("أضف بنداً واحداً على الأقل."); return; }
    const sup = suppliers.find((s) => s.id === supplierId);
    const p: Purchase = {
      id: uid(), created_at: Date.now(), date,
      supplierId: supplierId || undefined,
      supplierName: sup?.name || supplierName.trim() || undefined,
      items: clean.map((it) => ({ name: it.name.trim(), qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0 })),
      total: purchaseTotal(clean), paid, notes: notes.trim() || undefined,
    };
    addPurchase(p);
    setPurchases(getPurchases());
    resetForm();
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return purchases;
    return purchases.filter((p) =>
      (p.supplierName ?? "").toLowerCase().includes(term) ||
      p.items.some((it) => it.name.toLowerCase().includes(term))
    );
  }, [purchases, q]);

  function remove(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(ids.length === 1 ? "حذف هذه العملية؟" : `حذف ${ids.length} عملية؟`)) return;
    deletePurchases(ids);
    setPurchases(getPurchases());
    setChecked((c) => { const n = new Set(c); ids.forEach((id) => n.delete(id)); return n; });
  }
  function toggle(id: string) { setChecked((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  const allChecked = filtered.length > 0 && filtered.every((p) => checked.has(p.id));
  function toggleAll() {
    setChecked((c) => { const n = new Set(c); allChecked ? filtered.forEach((p) => n.delete(p.id)) : filtered.forEach((p) => n.add(p.id)); return n; });
  }

  const grandTotal = purchases.reduce((s, p) => s + Number(p.total || 0), 0);
  const unpaidTotal = purchases.filter((p) => !p.paid).reduce((s, p) => s + Number(p.total || 0), 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="size-6" /> المشتريات</h1>
        <p className="mt-1 text-sm text-muted">منظومة مشتريات محلية مستقلة — سجّل عمليات الشراء وتابع المصروف. تعمل بدون إنترنت.</p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="عدد العمليات" value={String(purchases.length)} />
        <StatCard label="إجمالي المصروف" value={`${money(grandTotal)} د.ع`} />
        <StatCard label="غير مدفوع" value={`${money(unpaidTotal)} د.ع`} tone={unpaidTotal > 0 ? "danger" : undefined} />
      </div>

      {/* Add purchase */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 text-sm font-semibold">تسجيل عملية شراء</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">المورّد
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`mt-1 ${inp}`}>
              <option value="">— اختر / اكتب أدناه —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {!supplierId && (
            <label className="text-sm font-medium">أو اسم مورّد مباشر<input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={`mt-1 ${inp}`} /></label>
          )}
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4" /> مدفوعة
          </label>
        </div>

        {/* Line items */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold text-muted">البنود</div>
          <div className="flex flex-col gap-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_110px_110px_auto] items-center gap-2">
                <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="الصنف" className={inp} />
                <input type="number" step="any" min="0" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} placeholder="الكمية" className={`${inp} tabular-nums`} />
                <input type="number" step="any" min="0" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} placeholder="سعر الوحدة" className={`${inp} tabular-nums`} />
                <div className="text-sm tabular-nums text-muted">{money(Number(it.qty || 0) * Number(it.unitPrice || 0))} د.ع</div>
                <button onClick={() => removeRow(i)} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50" title="حذف البند"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={addRow} className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"><Plus className="size-3.5" /> إضافة بند</button>
        </div>

        <div className="mt-3">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className={inp} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm">الإجمالي: <b className="tabular-nums text-amber-700">{money(total)} د.ع</b></div>
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            <Plus className="size-4" /> حفظ العملية
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالمورّد أو الصنف…" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        {checked.size > 0 && (
          <button onClick={() => remove(Array.from(checked))} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            <Trash2 className="size-4" /> حذف المحدَّد ({checked.size})
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4 align-middle" aria-label="تحديد الكل" /></th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المورّد</th>
              <th className="px-4 py-3 font-medium">البنود</th>
              <th className="px-4 py-3 font-medium">الإجمالي</th>
              <th className="px-4 py-3 font-medium">الدفع</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">{purchases.length === 0 ? "لا عمليات شراء بعد" : "لا نتائج مطابقة"}</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className={`border-b border-line last:border-0 hover:bg-canvas ${checked.has(p.id) ? "bg-amber-50" : ""}`}>
                <td className="px-4 py-3"><input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} className="size-4 align-middle" /></td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">{p.date}</td>
                <td className="px-4 py-3 font-medium">{p.supplierName ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{p.items.map((it) => it.name).join("، ")}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{money(p.total)} د.ع</td>
                <td className="px-4 py-3">
                  {p.paid
                    ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand-dark">مدفوعة</span>
                    : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">غير مدفوعة</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => remove([p.id])} className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
