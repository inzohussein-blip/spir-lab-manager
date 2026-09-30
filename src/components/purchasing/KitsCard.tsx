"use client";

import { useEffect, useState } from "react";
import { Package, Plus, Pencil, Trash2, X } from "lucide-react";
import { getKits, saveKits, uid, type Kit } from "@/lib/purchasing/store";
import type { StockItem } from "@/lib/station/store";
import { NumberInput } from "@/components/local/NumberInput";
import { inp } from "./stockParts";

type Part = { stockId: string; qty: string };
const blank = (): { name: string; barcode: string; parts: Part[] } => ({ name: "", barcode: "", parts: [{ stockId: "", qty: "1" }] });

/**
 * «الكتات» in «الأصناف»: a kit is what the supplier sells as one package, made of the lab's items —
 * e.g. «كت السكر» = 4 × «كاشف السكر» + 1 × «محلول المعايرة». In «المشتريات» a kit is bought like any
 * line, and its contents (times the kits bought) go to the stock room.
 */
export function KitsCard({ stock, barcode }: { stock: StockItem[]; barcode: boolean }) {
  const [kits, setKits] = useState<Kit[]>([]);
  const [f, setF] = useState(blank());
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { setKits(getKits()); }, []);

  const nameOf = (id: string) => stock.find((s) => s.id === id)?.name ?? "صنف محذوف";
  function persist(next: Kit[]) { setKits(next); saveKits(next); }
  function reset() { setF(blank()); setEditId(null); setMsg(""); }
  function setPart(i: number, patch: Partial<Part>) { setF((x) => ({ ...x, parts: x.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) })); }
  function submit() {
    const parts = f.parts.map((p) => ({ stockId: p.stockId, qty: Number(p.qty) || 0 })).filter((p) => p.stockId && p.qty > 0);
    if (!f.name.trim()) { setMsg("اكتب اسم الكت."); return; }
    if (!parts.length) { setMsg("اختر صنفاً واحداً على الأقل وكميته في الكت."); return; }
    if (stock.some((s) => s.name.trim().toLowerCase() === f.name.trim().toLowerCase())) { setMsg("هذا الاسم لصنف في المخزن — اختر اسماً آخر للكت."); return; }
    const old = kits.find((k) => k.id === editId);
    const rec: Kit = { id: editId ?? uid(), name: f.name.trim(), parts, ...(barcode ? (f.barcode.trim() ? { barcode: f.barcode.trim() } : {}) : old?.barcode ? { barcode: old.barcode } : {}) };
    persist(editId ? kits.map((k) => (k.id === editId ? rec : k)) : [...kits, rec]);
    reset();
  }
  function edit(k: Kit) {
    setF({ name: k.name, barcode: k.barcode ?? "", parts: k.parts.length ? k.parts.map((p) => ({ stockId: p.stockId, qty: String(p.qty) })) : blank().parts });
    setEditId(k.id); setMsg("");
  }
  function del(id: string) {
    if (!window.confirm("حذف هذا الكت؟ الأصناف نفسها تبقى في المخزن.")) return;
    persist(kits.filter((k) => k.id !== id));
    if (editId === id) reset();
  }

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" data-testid="items-kits">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4" /> الكتات</div>
        <span className="text-xs text-muted">ما يُشترى علبةً واحدة ويحتوي أصنافاً من المخزن — عند شرائه تُضاف محتوياته.</span>
      </div>

      <div className="border-b border-line p-4" data-testid="kit-form">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-muted">{editId ? "تعديل كت" : "كت جديد"}</div>
          {editId && <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="size-3.5" /> إلغاء</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم الكت *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="اسم الكت" placeholder="مثلاً: كت السكر" className={`mt-1 ${inp}`} /></label>
          {barcode && <label className="text-sm font-medium">باركود الكت<input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} aria-label="باركود الكت" dir="ltr" className={`mt-1 ${inp}`} /></label>}
        </div>
        <div className="mt-3 text-sm font-medium">ما يحتويه الكت</div>
        <div className="mt-1 flex flex-col gap-2">
          {f.parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-center gap-2">
              <select value={p.stockId} onChange={(e) => setPart(i, { stockId: e.target.value })} aria-label="صنف في الكت" className={inp}>
                <option value="">— اختر صنفاً —</option>
                {stock.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <NumberInput value={p.qty} onValue={(v) => setPart(i, { qty: v })} aria-label="الكمية في الكت" placeholder="الكمية" className={inp} />
              <button onClick={() => setF((x) => ({ ...x, parts: x.parts.length > 1 ? x.parts.filter((_, j) => j !== i) : x.parts }))} aria-label="حذف من الكت"
                className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><X className="size-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setF((x) => ({ ...x, parts: [...x.parts, { stockId: "", qty: "1" }] }))} className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"><Plus className="size-3.5" /> صنف آخر في الكت</button>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={submit} data-testid="kit-save" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            <Plus className="size-4" /> {editId ? "حفظ الكت" : "حفظ كت جديد"}
          </button>
          {msg && <span className="text-xs text-red-600" role="alert">{msg}</span>}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-line text-right text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">الكت</th>
            <th className="px-4 py-2 font-medium">يحتوي</th>
            {barcode && <th className="px-4 py-2 font-medium">الباركود</th>}
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {kits.length === 0 && <tr><td colSpan={barcode ? 4 : 3} className="px-4 py-6 text-center text-muted">لا كتات بعد.</td></tr>}
          {kits.map((k) => (
            <tr key={k.id} className="border-b border-line last:border-0 hover:bg-canvas" data-kit={k.name}>
              <td className="px-4 py-2 font-medium">{k.name}</td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {k.parts.map((p) => <span key={p.stockId} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800">{nameOf(p.stockId)} <b dir="ltr">× {p.qty}</b></span>)}
                </div>
              </td>
              {barcode && <td className="px-4 py-2 font-mono text-xs text-muted" dir="ltr">{k.barcode ?? "—"}</td>}
              <td className="px-4 py-2">
                <div className="flex gap-1">
                  <button onClick={() => edit(k)} aria-label={`تعديل ${k.name}`} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                  <button onClick={() => del(k.id)} aria-label={`حذف ${k.name}`} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
