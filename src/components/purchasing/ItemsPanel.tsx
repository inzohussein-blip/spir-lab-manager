"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, PackagePlus, Search, Package, X } from "lucide-react";
import { getStock, saveStock, getTests, uid, stockTestIds, type StockItem, type StationTest } from "@/lib/station/store";
import { consumablePresets } from "@/lib/purchasing/presets";
import { NumberInput } from "@/components/local/NumberInput";
import { qcLinks } from "@/lib/local/links";
import { getSettings, getKits, saveKits, type PurchasingSettings, type Kit } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";
import { TestPicker, inp, Modal, Chips } from "./stockParts";

type Tab = "items" | "tests" | "kits";
type Kind = "test" | "visit";
const blank = { name: "", qty: "", minQty: "", expiry: "", testIds: [] as string[], kind: "test" as Kind, price: "", barcode: "" };
/** The name a test's own material gets when made from «الأصناف». */
const materialName = (t: StationTest) => `كاشف ${t.name_ar}`;

/**
 * «الأصناف»: what the stock room holds. Three tabs, one thing each:
 *  - «الأصناف»: the list, with «صنف جديد» (a small window) and edit / delete;
 *  - «التحاليل»: the lab station's tests (from «إدارة الفحوصات») and the material each uses;
 *  - «الكتات»: packages bought as one (their contents go to the stock room).
 */
export function ItemsPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [qc, setQc] = useState<Map<string, string[]>>(new Map());
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [tab, setTab] = useState<Tab>("items");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<StockItem | "new" | null>(null);
  const [kitEditing, setKitEditing] = useState<Kit | "new" | null>(null);

  useEffect(() => {
    const list = getStock();
    setRows(list); setTests(getTests()); setKits(getKits()); setQc(qcLinks()); setOpts(getSettings());
    // «المخزن» links here: ?edit=<id> opens that item, ?new=1 a new one.
    const u = new URLSearchParams(window.location.search);
    const s = list.find((x) => x.id === u.get("edit"));
    if (s) setEditing(s); else if (u.get("new")) setEditing("new");
  }, []);

  function persist(next: StockItem[]) { setRows(next); saveStock(next); }
  function saveItem(rec: StockItem) { persist(rows.some((r) => r.id === rec.id) ? rows.map((r) => (r.id === rec.id ? rec : r)) : [...rows, rec]); setEditing(null); }
  function delItem(id: string) {
    if (!window.confirm("حذف هذا الصنف من المخزن؟")) return;
    persist(rows.filter((r) => r.id !== id)); setEditing(null);
  }
  function persistKits(next: Kit[]) { setKits(next); saveKits(next); }

  // Per test: its own materials (one unit per test) and its tubes / containers (one per visit).
  const { own, perVisit } = useMemo(() => {
    const own = new Map<string, StockItem[]>(), perVisit = new Map<string, StockItem[]>();
    for (const s of rows) for (const id of stockTestIds(s)) {
      const m = s.perVisit ? perVisit : own;
      m.set(id, [...(m.get(id) ?? []), s]);
    }
    return { own, perVisit };
  }, [rows]);
  const missing = tests.filter((t) => !own.has(t.id));

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

  const term = q.trim().toLowerCase();
  const kindText = (s: StockItem) => (s.perVisit ? "أنبوب / علبة" : stockTestIds(s).length ? "كاشف" : qc.has(s.id) ? "مادة سيطرة" : "مادة");
  const testNames = (s: StockItem) => stockTestIds(s).map((id) => tests.find((t) => t.id === id)?.name_ar).filter(Boolean) as string[];
  const shownItems = rows.filter((s) => !term || s.name.toLowerCase().includes(term));
  const shownTests = tests.filter((t) => !term || t.name_ar.toLowerCase().includes(term) || (t.name_en ?? "").toLowerCase().includes(term) || (t.code ?? "").toLowerCase().includes(term));
  const shownKits = kits.filter((k) => !term || k.name.toLowerCase().includes(term));
  const nameOf = (id: string) => rows.find((s) => s.id === id)?.name ?? "صنف محذوف";
  const btn = "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search className="size-5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" aria-label="بحث في الأصناف" className="w-full bg-transparent py-2.5 text-base outline-none" />
        </label>
        {tab === "kits"
          ? <button onClick={() => setKitEditing("new")} data-testid="kit-new" className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}><Plus className="size-4" /> كت جديد</button>
          : <button onClick={() => setEditing("new")} data-testid="item-new" className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}><Plus className="size-4" /> صنف جديد</button>}
      </div>
      <Chips label="الأقسام" value={tab} onChange={setTab}
        options={[["items", "الأصناف", rows.length], ["tests", "التحاليل وموادها", tests.length], ["kits", "الكتات", kits.length]]} />

      {tab === "items" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" data-testid="items-list">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الصنف</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">يُستعمل في</th>
                <th className="px-4 py-3 font-medium">الكمية</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {shownItems.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">
                  {rows.length ? "لا أصناف مطابقة." : <>لا أصناف بعد — «صنف جديد»، أو <button onClick={addPresets} className="text-amber-700 underline">الأنابيب والمستلزمات الشائعة</button>.</>}
                </td></tr>
              )}
              {shownItems.map((s) => {
                const n = testNames(s);
                return (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 font-semibold">{s.name}</td>
                    <td className="px-4 py-3 text-muted">{kindText(s)}</td>
                    <td className="px-4 py-3 text-xs text-muted" title={n.join("، ")}>
                      {n.length ? (n.length <= 2 ? n.join("، ") : `${n.length} تحليل`) : qc.has(s.id) ? `سيطرة: ${qc.get(s.id)!.join("، ")}` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>{s.qty}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(s)} aria-label={`تعديل ${s.name}`} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-surface"><Pencil className="size-4" /></button>
                        <button onClick={() => delItem(s.id)} aria-label={`حذف ${s.name}`} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-line px-4 py-2.5">
            <button onClick={addPresets} data-testid="stock-presets" className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:underline">
              <PackagePlus className="size-4" /> إضافة الأنابيب والمستلزمات الشائعة (مرتبطة بتحاليلها)
            </button>
          </div>
        </div>
      )}

      {tab === "tests" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" data-testid="items-tests">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
            تحاليل «إدارة الفحوصات» في محطة المختبر، والمادة التي يُحسم منها كل تحليل.
            {missing.length > 0 && (
              <button onClick={addAllMissing} data-testid="items-bulk" className="ms-auto rounded-lg border border-amber-300 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-50">
                مادة لكل تحليل بلا مادة ({missing.length})
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">التحليل</th>
                <th className="px-4 py-2 font-medium">مادته</th>
                {opts.prices && <th className="px-4 py-2 font-medium">الكلفة</th>}
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {shownTests.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">{tests.length ? "لا تحاليل مطابقة." : "افتح محطة المختبر مرة لتظهر تحاليلها هنا."}</td></tr>}
              {shownTests.map((t) => {
                const mats = [...(own.get(t.id) ?? []), ...(perVisit.get(t.id) ?? [])];
                const priced = mats.filter((m) => m.price != null);
                return (
                  <tr key={t.id} data-test={t.code ?? t.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{t.name_ar}</div>
                      {t.category && <div className="text-[11px] text-muted">{t.category}</div>}
                    </td>
                    <td className="px-4 py-2" data-testid="test-materials">
                      {mats.length ? (
                        <div className="flex flex-wrap gap-1">
                          {mats.map((m) => (
                            <button key={m.id} onClick={() => setEditing(m)} className={`rounded-full px-2 py-0.5 text-xs hover:underline ${m.perVisit ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"}`}>
                              {m.name} <b dir="ltr">{m.qty}</b>
                            </button>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted">—</span>}
                    </td>
                    {opts.prices && (
                      <td className="px-4 py-2 tabular-nums" data-testid="test-cost">
                        {priced.length ? `${money(priced.reduce((n, m) => n + m.price!, 0))} د.ع` : <span className="text-xs text-muted">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-2 text-end">
                      {!own.has(t.id) && (
                        <button onClick={() => addFor(t)} aria-label={`مادة لـ ${t.name_ar}`} data-testid="add-material" title={`إضافة «${materialName(t)}» إلى الأصناف`}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-canvas"><Plus className="size-3.5" /> مادة</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "kits" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]" data-testid="items-kits">
          <div className="border-b border-line px-4 py-2.5 text-xs text-muted">الكت علبة تُشترى مرة واحدة وتحتوي أصنافاً — عند شرائها في «المشتريات» تُضاف محتوياتها إلى المخزن.</div>
          {shownKits.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">لا كتات بعد — «كت جديد».</p> : (
            <ul className="divide-y divide-line">
              {shownKits.map((k) => (
                <li key={k.id} data-kit={k.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Package className="size-5 text-violet-600" />
                  <div className="min-w-40 flex-1">
                    <div className="font-semibold">{k.name}</div>
                    <div className="text-xs text-muted">{k.parts.map((p) => `${nameOf(p.stockId)} × ${p.qty}`).join("، ")}</div>
                  </div>
                  <button onClick={() => setKitEditing(k)} aria-label={`تعديل ${k.name}`} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                  <button onClick={() => { if (window.confirm("حذف هذا الكت؟ الأصناف نفسها تبقى.")) persistKits(kits.filter((x) => x.id !== k.id)); }} aria-label={`حذف ${k.name}`}
                    className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <ItemDialog item={editing === "new" ? null : editing} tests={tests} opts={opts} onClose={() => setEditing(null)} onSave={saveItem}
          onDelete={editing === "new" ? undefined : () => delItem(editing.id)} />
      )}
      {kitEditing && (
        <KitDialog kit={kitEditing === "new" ? null : kitEditing} stock={rows} barcode={opts.barcode === true} onClose={() => setKitEditing(null)}
          onSave={(k) => { persistKits(kits.some((x) => x.id === k.id) ? kits.map((x) => (x.id === k.id ? k : x)) : [...kits, k]); setKitEditing(null); }} />
      )}
    </div>
  );
}

/** «صنف جديد» / editing an item: name, kind, quantity; the rest only when wanted. */
function ItemDialog({ item, tests, opts, onClose, onSave, onDelete }: {
  item: StockItem | null; tests: StationTest[]; opts: PurchasingSettings; onClose: () => void; onSave: (s: StockItem) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState(() => item ? {
    name: item.name, qty: String(item.qty), minQty: item.minQty != null ? String(item.minQty) : "", expiry: item.expiry ?? "",
    testIds: stockTestIds(item), kind: (item.perVisit ? "visit" : "test") as Kind, price: item.price != null ? String(item.price) : "", barcode: item.barcode ?? "",
  } : { ...blank });
  const [err, setErr] = useState("");
  function submit() {
    if (!f.name.trim()) { setErr("اكتب اسم الصنف."); return; }
    // Price and barcode: from the form when their option is on, else kept as they were.
    const price = opts.prices ? (f.price.trim() ? Number(f.price) : undefined) : item?.price;
    const barcode = opts.barcode ? f.barcode.trim() || undefined : item?.barcode;
    onSave({
      ...(price != null ? { price } : {}),
      ...(barcode ? { barcode } : {}),
      id: item?.id ?? uid(),
      name: f.name.trim(),
      qty: Number(f.qty) || 0,
      minQty: f.minQty.trim() ? Number(f.minQty) : undefined,
      expiry: f.expiry || undefined,
      testIds: f.testIds.length ? f.testIds : undefined,
      perVisit: f.kind === "visit" || undefined,
    });
  }
  const kindBtn = (k: Kind, title: string, hint: string) => (
    <button type="button" onClick={() => setF({ ...f, kind: k })} aria-pressed={f.kind === k}
      className={`flex-1 rounded-xl border px-3 py-2 text-start ${f.kind === k ? "border-amber-500 bg-amber-50" : "border-line hover:bg-canvas"}`}>
      <span className="block text-sm font-semibold">{title}</span><span className="block text-[11px] text-muted">{hint}</span>
    </button>
  );
  return (
    <Modal title={item ? `تعديل: ${item.name}` : "صنف جديد"} onClose={onClose} testid="item-form" wide>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
        <label className="text-sm font-medium">اسم الصنف *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus className={`mt-1 ${inp} text-base`} /></label>
        <div className="flex gap-2">
          {kindBtn("test", "كاشف / مادة", "يُحسم وحدة لكل فحص")}
          {kindBtn("visit", "أنبوب / علبة", "يُحسم وحدة لكل زيارة")}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">الكمية<NumberInput value={f.qty} onValue={(v) => setF({ ...f, qty: v })} aria-label="الكمية" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">تنبيه عند<NumberInput value={f.minQty} onValue={(v) => setF({ ...f, minQty: v })} aria-label="الحد الأدنى للتنبيه" placeholder="اختياري" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">ينتهي في<input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} aria-label="تاريخ الانتهاء" className={`mt-1 ${inp}`} /></label>
          {opts.prices && <label className="text-sm font-medium">سعر الوحدة<NumberInput value={f.price} onValue={(v) => setF({ ...f, price: v })} group aria-label="سعر الوحدة" className={`mt-1 ${inp}`} /></label>}
          {opts.barcode && <label className="text-sm font-medium sm:col-span-2">الباركود<input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} aria-label="باركود الصنف" placeholder="امسح باركود العلبة هنا" dir="ltr" className={`mt-1 ${inp}`} /></label>}
        </div>
        <details className="rounded-xl border border-line" open={f.testIds.length > 0}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">التحاليل التي تستعمله {f.testIds.length > 0 && <span className="text-amber-700">({f.testIds.length})</span>} <span className="text-xs font-normal text-muted">— ليُحسم منه تلقائياً</span></summary>
          <div className="p-2"><TestPicker tests={tests} value={f.testIds} onChange={(ids) => setF({ ...f, testIds: ids })} /></div>
        </details>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-base font-semibold text-white hover:bg-amber-700">{item ? "حفظ التعديل" : "إضافة الصنف"}</button>
          {onDelete && <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-4 py-3 text-sm text-red-700 hover:bg-red-50"><Trash2 className="size-4" /> حذف</button>}
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-3 text-sm hover:bg-canvas">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}

type Part = { stockId: string; qty: string };
/** «كت جديد» / editing a kit: its name and what it holds. */
function KitDialog({ kit, stock, barcode, onClose, onSave }: { kit: Kit | null; stock: StockItem[]; barcode: boolean; onClose: () => void; onSave: (k: Kit) => void }) {
  const [name, setName] = useState(kit?.name ?? "");
  const [code, setCode] = useState(kit?.barcode ?? "");
  const [parts, setParts] = useState<Part[]>(kit?.parts.length ? kit.parts.map((p) => ({ stockId: p.stockId, qty: String(p.qty) })) : [{ stockId: "", qty: "1" }]);
  const [err, setErr] = useState("");
  const setPart = (i: number, patch: Partial<Part>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  function submit() {
    const clean = parts.map((p) => ({ stockId: p.stockId, qty: Number(p.qty) || 0 })).filter((p) => p.stockId && p.qty > 0);
    if (!name.trim()) { setErr("اكتب اسم الكت."); return; }
    if (!clean.length) { setErr("اختر صنفاً واحداً على الأقل وكميته في الكت."); return; }
    if (stock.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())) { setErr("هذا الاسم لصنف — اختر اسماً آخر للكت."); return; }
    onSave({ id: kit?.id ?? uid(), name: name.trim(), parts: clean, ...(barcode ? (code.trim() ? { barcode: code.trim() } : {}) : kit?.barcode ? { barcode: kit.barcode } : {}) });
  }
  return (
    <Modal title={kit ? `تعديل: ${kit.name}` : "كت جديد"} onClose={onClose} testid="kit-form" wide>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم الكت *<input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="اسم الكت" placeholder="مثلاً: كت السكر" className={`mt-1 ${inp} text-base`} /></label>
          {barcode && <label className="text-sm font-medium">باركود الكت<input value={code} onChange={(e) => setCode(e.target.value)} aria-label="باركود الكت" dir="ltr" className={`mt-1 ${inp}`} /></label>}
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">يحتوي</div>
          <div className="flex flex-col gap-2">
            {parts.map((p, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-center gap-2">
                <select value={p.stockId} onChange={(e) => setPart(i, { stockId: e.target.value })} aria-label="صنف في الكت" className={inp}>
                  <option value="">— اختر صنفاً —</option>
                  {stock.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <NumberInput value={p.qty} onValue={(v) => setPart(i, { qty: v })} aria-label="الكمية في الكت" placeholder="العدد" className={inp} />
                <button type="button" onClick={() => setParts((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps))} aria-label="حذف من الكت"
                  className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setParts((ps) => [...ps, { stockId: "", qty: "1" }])} className="mt-2 inline-flex items-center gap-1 text-sm text-amber-700 hover:underline"><Plus className="size-4" /> صنف آخر في الكت</button>
        </div>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" data-testid="kit-save" className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-base font-semibold text-white hover:bg-amber-700">{kit ? "حفظ الكت" : "إضافة الكت"}</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-3 text-sm hover:bg-canvas">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
