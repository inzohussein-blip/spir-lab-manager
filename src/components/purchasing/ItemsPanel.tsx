"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, PackagePlus, Search, FlaskConical, TestTubes, Package } from "lucide-react";
import { getStock, saveStock, getTests, uid, stockTestIds, type StockItem, type StationTest } from "@/lib/station/store";
import { consumablePresets } from "@/lib/purchasing/presets";
import { NumberInput } from "@/components/local/NumberInput";
import { qcLinks } from "@/lib/local/links";
import { TestPicker, Tile, inp } from "./stockParts";
import { KitsCard } from "./KitsCard";
import { getSettings, type PurchasingSettings } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";

const empty = { name: "", qty: "", minQty: "", expiry: "", testIds: [] as string[], perVisit: false, price: "", barcode: "" };
/** The name a test's own material gets when made from «الأصناف». */
const materialName = (t: StationTest) => `كاشف ${t.name_ar}`;

/**
 * «الأصناف»: what the stock room can hold, taken from the lab station's «إدارة الفحوصات» — every
 * supported test with its material(s), then the tubes and consumables (one per visit), then any other
 * material (e.g. a control material for quality). A test deleted in the lab station leaves its
 * materials here unlinked; a renamed test shows its new name.
 */
export function ItemsPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [qc, setQc] = useState<Map<string, string[]>>(new Map());
  const [f, setF] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });

  useEffect(() => {
    const list = getStock();
    setRows(list); setTests(getTests()); setQc(qcLinks()); setOpts(getSettings());
    // «المخزن» links here to change an item (?edit=<id>).
    const id = new URLSearchParams(window.location.search).get("edit");
    const s = id ? list.find((x) => x.id === id) : undefined;
    if (s) {
      setF({ name: s.name, qty: String(s.qty), minQty: s.minQty != null ? String(s.minQty) : "", expiry: s.expiry ?? "", testIds: stockTestIds(s), perVisit: !!s.perVisit, price: s.price != null ? String(s.price) : "", barcode: s.barcode ?? "" });
      setEditId(s.id);
      setTimeout(() => document.getElementById("item-form")?.scrollIntoView({ block: "start" }), 50);
    }
  }, []);

  function persist(next: StockItem[]) { setRows(next); saveStock(next); }
  function reset() { setF({ ...empty }); setEditId(null); }
  function fill(s: StockItem) {
    setF({ name: s.name, qty: String(s.qty), minQty: s.minQty != null ? String(s.minQty) : "", expiry: s.expiry ?? "", testIds: stockTestIds(s), perVisit: !!s.perVisit, price: s.price != null ? String(s.price) : "", barcode: s.barcode ?? "" });
    setEditId(s.id);
  }
  function edit(s: StockItem) { fill(s); document.getElementById("item-form")?.scrollIntoView({ block: "start", behavior: "smooth" }); }
  function submit() {
    if (!f.name.trim()) return;
    const old = rows.find((r) => r.id === editId);
    // Price and barcode: from the form when their option is on, else kept as they were.
    const price = opts.prices ? (f.price.trim() ? Number(f.price) : undefined) : old?.price;
    const barcode = opts.barcode ? f.barcode.trim() || undefined : old?.barcode;
    const rec: StockItem = {
      ...(price != null ? { price } : {}),
      ...(barcode ? { barcode } : {}),
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
  function del(id: string) {
    if (!window.confirm("حذف هذا الصنف من المخزن؟")) return;
    persist(rows.filter((r) => r.id !== id));
    if (editId === id) reset();
  }

  // Per test: its own materials (one unit per test) and the tubes / containers it uses (one per visit).
  const { own, perVisit } = useMemo(() => {
    const own = new Map<string, StockItem[]>(), perVisit = new Map<string, StockItem[]>();
    for (const s of rows) for (const id of stockTestIds(s)) {
      const m = s.perVisit ? perVisit : own;
      m.set(id, [...(m.get(id) ?? []), s]);
    }
    return { own, perVisit };
  }, [rows]);
  const missing = tests.filter((t) => !own.has(t.id));
  const consumables = rows.filter((s) => s.perVisit);
  const others = rows.filter((s) => !s.perVisit && stockTestIds(s).length === 0);

  /** A test's own material (stock 0; the quantity comes with purchases) — or link one of the same name. */
  function addFor(t: StationTest) {
    const name = materialName(t);
    const same = rows.find((s) => s.name.trim() === name);
    persist(same
      ? rows.map((s) => (s.id === same.id ? { ...s, testIds: Array.from(new Set([...stockTestIds(s), t.id])), linkedTestId: undefined } : s))
      : [...rows, { id: uid(), name, qty: 0, testIds: [t.id] }]);
  }
  function addAllMissing() {
    if (!missing.length || !window.confirm(`إضافة مادة (كاشف) لكل تحليل ليس له مادة؟ (${missing.length} تحليل، بكمية 0 تُكمَّل بالشراء)`)) return;
    const have = new Set(rows.map((s) => s.name.trim()));
    persist([...rows, ...missing.filter((t) => !have.has(materialName(t))).map((t): StockItem => ({ id: uid(), name: materialName(t), qty: 0, testIds: [t.id] }))]);
  }
  /** The lab's common tubes and containers, already linked to their tests (missing ones only). */
  function addPresets() {
    const have = new Set(rows.map((r) => r.name.trim()));
    const add = consumablePresets(tests).filter((p) => !have.has(p.name))
      .map((p): StockItem => ({ id: uid(), name: p.name, qty: 0, testIds: p.testIds, perVisit: true }));
    if (!add.length) { window.alert("الأنابيب والمستلزمات الشائعة موجودة."); return; }
    persist([...rows, ...add]);
  }

  // The tests, grouped by department, narrowed by the search.
  const term = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const m = new Map<string, StationTest[]>();
    for (const t of tests) {
      if (missingOnly && own.has(t.id)) continue;
      if (term && !t.name_ar.toLowerCase().includes(term) && !(t.name_en ?? "").toLowerCase().includes(term) && !(t.code ?? "").toLowerCase().includes(term)) continue;
      const c = t.category || "أخرى";
      m.set(c, [...(m.get(c) ?? []), t]);
    }
    return [...m];
  }, [tests, term, missingOnly, own]);

  const chip = (s: StockItem, tone: "own" | "visit") => (
    <button key={s.id} type="button" onClick={() => edit(s)} title="تعديل الصنف"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:underline ${tone === "own" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-700"}`}>
      {s.name} <b className="tabular-nums" dir="ltr">{s.qty}</b>
    </button>
  );
  const rowActions = (s: StockItem) => (
    <div className="flex gap-1">
      <button onClick={() => edit(s)} aria-label={`تعديل ${s.name}`} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
      <button onClick={() => del(s.id)} aria-label={`حذف ${s.name}`} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
    </div>
  );
  const card = "rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        الأصناف مأخوذة من «إدارة الفحوصات» في محطة المختبر: كل تحليل مدعوم ومادته (الكاشف يُحسم وحدةً لكل فحص)، ثم الأنابيب
        والمستلزمات (وحدة لكل زيارة فيها أحد فحوصاتها)، ثم المواد الأخرى. الكمية تُضاف بالشراء وتظهر في «المخزن».
      </p>

      <div className="grid gap-4 sm:grid-cols-4">
        <Tile label="التحاليل المدعومة" value={tests.length} />
        <Tile label="تحاليل لها مادة" value={tests.length - missing.length} />
        <Tile label="تحاليل بلا مادة" value={missing.length} tone={missing.length ? "warn" : undefined} />
        <Tile label="أنابيب ومستلزمات" value={consumables.length} />
      </div>

      {/* Add / edit an item */}
      <div id="item-form" className={`${card} scroll-mt-4 p-5`} data-testid="item-form">
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
          {opts.prices && <label className="text-sm font-medium">سعر الوحدة (د.ع)<NumberInput value={f.price} onValue={(v) => setF({ ...f, price: v })} group aria-label="سعر الوحدة" className={`mt-1 ${inp}`} /></label>}
          {opts.barcode && <label className="text-sm font-medium">الباركود<input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} aria-label="باركود الصنف" placeholder="امسح باركود العلبة هنا" dir="ltr" className={`mt-1 ${inp}`} /></label>}
          <div className="text-sm font-medium sm:col-span-2 lg:col-span-3">
            التحاليل المرتبطة من محطة المختبر
            <div className="mt-1"><TestPicker tests={tests} value={f.testIds} onChange={(ids) => setF({ ...f, testIds: ids })} /></div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            <Plus className="size-4" /> {editId ? "حفظ التعديل" : "إضافة"}
          </button>
          {editId && (
            <button onClick={() => del(editId)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              <Trash2 className="size-4" /> حذف الصنف
            </button>
          )}
        </div>
      </div>

      {/* The supported tests and their materials */}
      <div className={card} data-testid="items-tests">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="size-4" /> التحاليل المدعومة وموادها</div>
          <span className="text-xs text-muted">من «إدارة الفحوصات» في محطة المختبر</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن تحليل…" aria-label="بحث في التحاليل" className="w-48 rounded-lg border border-line bg-surface py-1.5 pe-2 ps-8 text-sm outline-none focus:border-brand" />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
              <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> بلا مادة فقط
            </label>
            {missing.length > 0 && (
              <button onClick={addAllMissing} data-testid="items-bulk" className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50">
                <PackagePlus className="size-3.5" /> مادة لكل تحليل بلا مادة ({missing.length})
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-line bg-surface text-right text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">التحليل</th>
                <th className="px-4 py-2 font-medium">مادته (الكمية)</th>
                <th className="px-4 py-2 font-medium">أنبوب / علبة</th>
                {opts.prices && <th className="px-4 py-2 font-medium">كلفة الفحص</th>}
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && <tr><td colSpan={opts.prices ? 5 : 4} className="px-4 py-6 text-center text-muted">{tests.length ? "لا تحاليل مطابقة." : "افتح محطة المختبر مرة لتظهر تحاليلها هنا."}</td></tr>}
              {groups.map(([cat, list]) => [
                <tr key={`c-${cat}`}><td colSpan={opts.prices ? 5 : 4} className="bg-canvas px-4 py-1.5 text-xs font-bold text-muted">{cat}</td></tr>,
                ...list.map((t) => (
                  <tr key={t.id} data-test={t.code ?? t.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{t.name_ar}</div>
                      {(t.name_en || t.code) && <div className="text-[11px] text-muted" dir="ltr" style={{ textAlign: "right" }}>{[t.code, t.name_en].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="px-4 py-2" data-testid="test-materials">
                      <div className="flex flex-wrap gap-1">{(own.get(t.id) ?? []).map((s) => chip(s, "own"))}{!own.has(t.id) && <span className="text-xs text-muted">—</span>}</div>
                    </td>
                    <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{(perVisit.get(t.id) ?? []).map((s) => chip(s, "visit"))}</div></td>
                    {opts.prices && (() => {
                      // One unit of each of its own materials, plus its tubes (used once per visit).
                      const mats = [...(own.get(t.id) ?? []), ...(perVisit.get(t.id) ?? [])];
                      const priced = mats.filter((m) => m.price != null);
                      return (
                        <td className="px-4 py-2 tabular-nums" data-testid="test-cost" title={priced.map((m) => `${m.name}: ${money(m.price!)}`).join("\n")}>
                          {priced.length ? `${money(priced.reduce((n, m) => n + m.price!, 0))} د.ع` : <span className="text-xs text-muted">—</span>}
                          {priced.length > 0 && priced.length < mats.length && <span className="block text-[10px] text-amber-700">بعض المواد بلا سعر</span>}
                        </td>
                      );
                    })()}
                    <td className="px-4 py-2 text-end">
                      <button onClick={() => addFor(t)} aria-label={`مادة لـ ${t.name_ar}`} data-testid="add-material" title={`إضافة «${materialName(t)}» إلى المخزن`}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas">
                        <Plus className="size-3.5" /> مادة
                      </button>
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tubes and consumables */}
      <div className={card} data-testid="items-consumables">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><TestTubes className="size-4" /> الأنابيب والمستلزمات</div>
          <span className="text-xs text-muted">وحدة لكل زيارة فيها أحد تحاليلها</span>
          <button onClick={addPresets} data-testid="stock-presets" title="تُضاف مرتبطة بتحاليل محطة المختبر (وحدة لكل زيارة)"
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas">
            <PackagePlus className="size-4" /> الأنابيب والمستلزمات الشائعة
          </button>
        </div>
        <ItemTable rows={consumables} emptyText="لا أنابيب أو مستلزمات بعد." actions={rowActions} tests={tests} qc={qc} />
      </div>

      {/* Kits: packages made of the items above */}
      <KitsCard stock={rows} barcode={opts.barcode === true} />

      {/* Anything else */}
      <div className={card} data-testid="items-other">
        <div className="flex items-center gap-2 border-b border-line p-4 text-sm font-semibold"><Package className="size-4" /> مواد أخرى <span className="text-xs font-normal text-muted">غير مرتبطة بتحليل (مثل مواد الكنترول)</span></div>
        <ItemTable rows={others} emptyText="لا مواد أخرى." actions={rowActions} tests={tests} qc={qc} />
      </div>
    </div>
  );
}

function ItemTable({ rows, emptyText, actions, tests, qc }: {
  rows: StockItem[]; emptyText: string; actions: (s: StockItem) => React.ReactNode; tests: StationTest[]; qc: Map<string, string[]>;
}) {
  const names = (s: StockItem) => stockTestIds(s).map((id) => tests.find((t) => t.id === id)?.name_ar).filter(Boolean) as string[];
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-line text-right text-muted">
        <tr>
          <th className="px-4 py-2 font-medium">الصنف</th>
          <th className="px-4 py-2 font-medium">الكمية</th>
          <th className="px-4 py-2 font-medium">مرتبط بـ</th>
          <th className="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">{emptyText}</td></tr>}
        {rows.map((s) => {
          const n = names(s);
          return (
            <tr key={s.id} className="border-b border-line last:border-0 hover:bg-canvas">
              <td className="px-4 py-2 font-medium">{s.name}</td>
              <td className="px-4 py-2 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>{s.qty}</td>
              <td className="px-4 py-2 text-xs text-muted" title={n.join("، ")}>
                {n.length ? (n.length <= 2 ? n.join("، ") : `${n.length} تحليل`) : qc.has(s.id) ? `سيطرة: ${qc.get(s.id)!.join("، ")}` : "—"}
              </td>
              <td className="px-4 py-2">{actions(s)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
