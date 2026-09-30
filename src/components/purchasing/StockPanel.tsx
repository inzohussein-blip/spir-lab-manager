"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, AlertTriangle, CalendarClock, Search, PackagePlus } from "lucide-react";
import {
  getStock, saveStock, getTests, daysToExpiry, uid, stockTestIds,
  type StockItem, type StationTest,
} from "@/lib/station/store";
import { consumablePresets } from "@/lib/purchasing/presets";
import { NumberInput } from "@/components/local/NumberInput";
import { qcLinks } from "@/lib/local/links";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const empty = { name: "", qty: "", minQty: "", expiry: "", testIds: [] as string[], perVisit: false };

/** Pick the lab station's tests that use a stock item (search + ticks, grouped by department). */
function TestPicker({ tests, value, onChange }: { tests: StationTest[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const on = new Set(value);
  const term = q.trim().toLowerCase();
  const shown = tests.filter((t) => !term || t.name_ar.toLowerCase().includes(term) || (t.name_en ?? "").toLowerCase().includes(term) || (t.category ?? "").includes(q.trim()));
  const groups = new Map<string, StationTest[]>();
  for (const t of shown) groups.set(t.category || "أخرى", [...(groups.get(t.category || "أخرى") ?? []), t]);
  const toggle = (id: string) => onChange(on.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div data-testid="test-picker" className="rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فحص من محطة المختبر…" aria-label="بحث في الفحوصات" className="w-full bg-transparent py-2 text-sm outline-none" />
        <span className="shrink-0 text-xs text-muted tabular-nums">{value.length} مختار</span>
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="shrink-0 text-xs text-red-600 hover:underline">مسح</button>}
      </div>
      <div className="max-h-48 overflow-y-auto p-2">
        {[...groups].map(([cat, list]) => (
          <div key={cat} className="mb-1.5">
            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-muted">
              {cat}
              <button type="button" onClick={() => onChange(Array.from(new Set([...value, ...list.map((t) => t.id)])))} className="font-normal text-amber-700 hover:underline">الكل</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {list.map((t) => (
                <label key={t.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${on.has(t.id) ? "border-amber-400 bg-amber-50 text-amber-800" : "border-line hover:bg-canvas"}`}>
                  <input type="checkbox" checked={on.has(t.id)} onChange={() => toggle(t.id)} className="size-3" aria-label={t.name_ar} /> {t.name_ar}
                </label>
              ))}
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="px-1 py-2 text-xs text-muted">لا فحوصات مطابقة.</p>}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const c = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-amber-700";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

/** «المخزن» tab of «المشتريات والمخزن». */
export function StockPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [qc, setQc] = useState<Map<string, string[]>>(new Map());

  useEffect(() => { setRows(getStock()); setTests(getTests()); setQc(qcLinks()); }, []);

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
      testIds: f.testIds.length ? f.testIds : undefined,
      perVisit: f.perVisit || undefined,
    };
    persist(editId ? rows.map((r) => (r.id === editId ? rec : r)) : [...rows, rec]);
    reset();
  }
  function edit(s: StockItem) {
    setF({ name: s.name, qty: String(s.qty), minQty: s.minQty != null ? String(s.minQty) : "", expiry: s.expiry ?? "", testIds: stockTestIds(s), perVisit: !!s.perVisit });
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
  /** Add the lab's common tubes and containers, already linked to their tests (missing ones only). */
  function addPresets() {
    const have = new Set(rows.map((r) => r.name.trim()));
    const add = consumablePresets(tests).filter((p) => !have.has(p.name))
      .map((p): StockItem => ({ id: uid(), name: p.name, qty: 0, testIds: p.testIds, perVisit: true }));
    if (!add.length) { window.alert("الأنابيب والمستلزمات الشائعة موجودة في المخزن."); return; }
    persist([...rows, ...add]);
  }

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
        <p className="text-sm text-muted">أصناف المختبر (كواشف، أنابيب، علب، مستلزمات) بكمياتها وتواريخ انتهائها. مرتبط بفحوصات محطة المختبر: الكاشف يُحسم وحدةً لكل فحص، والأنبوب أو العلبة وحدةً لكل زيارة فيها أحد فحوصاته. وتُضاف الكمية عند الشراء.</p>
      </div>

      <div className="mb-3 flex justify-end">
        <button onClick={addPresets} data-testid="stock-presets" title="تُضاف مرتبطة بفحوصات محطة المختبر (وحدة لكل زيارة)" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-canvas">
          <PackagePlus className="size-4" /> الأنابيب والمستلزمات الشائعة
        </button>
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
          <label className="text-sm font-medium">الكمية<NumberInput value={f.qty} onValue={(v) => setF({ ...f, qty: v })} aria-label="الكمية" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">الحد الأدنى للتنبيه<NumberInput value={f.minQty} onValue={(v) => setF({ ...f, minQty: v })} aria-label="الحد الأدنى للتنبيه" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">تاريخ الانتهاء<input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">يُحسم من المخزن
            <select value={f.perVisit ? "visit" : "test"} onChange={(e) => setF({ ...f, perVisit: e.target.value === "visit" })} aria-label="طريقة الحسم" className={`mt-1 ${inp}`}>
              <option value="test">وحدة لكل فحص (كاشف / عُدّة)</option>
              <option value="visit">وحدة لكل زيارة (أنبوب، علبة، سرنجة)</option>
            </select>
          </label>
          <div className="text-sm font-medium sm:col-span-2 lg:col-span-3">
            الفحوصات المرتبطة من محطة المختبر (يُحسم عند إدخالها)
            <div className="mt-1"><TestPicker tests={tests} value={f.testIds} onChange={(ids) => setF({ ...f, testIds: ids })} /></div>
          </div>
        </div>
        <button onClick={submit} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
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
              <th className="px-4 py-3 font-medium">مرتبط بـ</th>
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
                  <td className="px-4 py-3 text-muted">
                    {(() => {
                      const ids = stockTestIds(s);
                      if (!ids.length) return qc.has(s.id) ? null : "—";
                      const names = ids.map(testName).filter(Boolean) as string[];
                      return (
                        <span data-testid="stock-tests" title={names.join("، ")} className="inline-flex flex-wrap items-center gap-1">
                          {ids.length === 1 ? names[0] : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{ids.length} فحص</span>}
                          {s.perVisit && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">لكل زيارة</span>}
                        </span>
                      );
                    })()}
                    {qc.has(s.id) && <span data-testid="qc-link" className="ms-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">سيطرة: {qc.get(s.id)!.join("، ")}</span>}
                  </td>
                  <td className={`px-4 py-3 ${expired ? "text-red-600" : soon ? "text-amber-700" : "text-muted"}`}>{s.expiry ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {low && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"><AlertTriangle className="size-3" /> نقص</span>}
                      {expired && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">منتهي</span>}
                      {soon && !expired && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><CalendarClock className="size-3" /> {d === 0 ? "ينتهي اليوم" : `${d} يوم`}</span>}
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
