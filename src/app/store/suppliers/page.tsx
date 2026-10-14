"use client";

import { useEffect, useState } from "react";
import { Truck, Plus, Trash2, Pencil, X, FileText, Printer } from "lucide-react";
import { getSuppliers, saveSuppliers, uid, getPurchases, getSettings, paidOf, dueOf, type Supplier, type Purchase } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const empty = { name: "", phone: "", note: "" };

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [debts, setDebts] = useState(false);
  const [statement, setStatement] = useState<string | null>(null);

  useEffect(() => { setRows(getSuppliers()); setPurchases(getPurchases()); setDebts(getSettings().debts === true); }, []);
  // Settings → «ديون الموردين»: each supplier's purchases, what was paid, and what is still owed.
  const of = (s: Supplier) => purchases.filter((p) => !p.ordered && (p.supplierId === s.id || (!p.supplierId && p.supplierName?.trim() === s.name.trim())));
  const sum = (list: Purchase[], f: (p: Purchase) => number) => list.reduce((t, p) => t + f(p), 0);

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
              {debts && <th className="px-4 py-3 font-medium">المشتريات</th>}
              {debts && <th className="px-4 py-3 font-medium">المدفوع</th>}
              {debts && <th className="px-4 py-3 font-medium">المتبقي</th>}
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={debts ? 7 : 4} className="px-4 py-8 text-center text-muted">لا موردين بعد</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} data-supplier={s.name} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{s.note ?? "—"}</td>
                {debts && <td className="px-4 py-3 tabular-nums">{money(sum(of(s), (p) => Number(p.total) || 0))}</td>}
                {debts && <td className="px-4 py-3 tabular-nums text-teal-700">{money(sum(of(s), paidOf))}</td>}
                {debts && <td className={`px-4 py-3 font-bold tabular-nums ${sum(of(s), dueOf) > 0 ? "text-red-600" : "text-muted"}`} data-testid="supplier-due">{money(sum(of(s), dueOf))}</td>}
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {debts && <button onClick={() => setStatement(s.id)} aria-label={`كشف حساب ${s.name}`} title="كشف حساب" className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><FileText className="size-4" /></button>}
                    <button onClick={() => edit(s)} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                    <button onClick={() => del(s.id)} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {debts && statement && (() => {
        const sup = rows.find((r) => r.id === statement);
        if (!sup) return null;
        // Purchases add to the balance, payments take from it — in date order.
        const lines = of(sup).flatMap((p) => [
          { date: p.date, at: p.created_at, text: `شراء: ${p.items.map((i) => i.name).join("، ")}`, debit: Number(p.total) || 0, credit: 0 },
          ...(p.payments?.length ? p.payments : p.paid ? [{ id: "", date: p.date, amount: Number(p.total) || 0 }] : [])
            .map((x) => ({ date: x.date, at: p.created_at + 1, text: "دفعة", debit: 0, credit: Number(x.amount) || 0 })),
        ]).sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1));
        let bal = 0;
        return (
          <div id="report-sheet" className="mt-5 rounded-2xl border border-line bg-white p-6 text-black shadow-[var(--shadow-card)] print:border-0 print:p-0 print:shadow-none" data-testid="statement">
            <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-amber-700">كشف حساب المورّد: {sup.name}</div>
                {sup.phone && <div className="text-xs text-gray-600" dir="ltr" style={{ textAlign: "right" }}>{sup.phone}</div>}
              </div>
              <div className="no-print flex gap-1">
                <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white"><Printer className="size-4" /> طباعة</button>
                <button onClick={() => setStatement(null)} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg border border-line"><X className="size-4" /></button>
              </div>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b-2 border-amber-600 text-right"><th className="py-1.5">التاريخ</th><th>البيان</th><th>عليه (شراء)</th><th>له (دفع)</th><th>الرصيد</th></tr></thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">لا حركات.</td></tr>}
                {lines.map((l, i) => {
                  bal += l.debit - l.credit;
                  return (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-1.5 text-xs">{l.date}</td>
                      <td className="text-xs">{l.text}</td>
                      <td className="tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                      <td className="tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                      <td className="tabular-nums font-semibold">{money(bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 text-left text-sm">المتبقي للمورّد: <b className="tabular-nums text-red-700" data-testid="statement-due">{money(sum(of(sup), dueOf))} د.ع</b></div>
          </div>
        );
      })()}
    </div>
  );
}
