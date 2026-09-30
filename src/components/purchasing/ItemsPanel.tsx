"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2, Pencil, PackagePlus, Search, Package, X, FlaskConical, Syringe, ShieldCheck } from "lucide-react";
import { getStock, saveStock, getTests, uid, stockTestIds, isByHand, type StockItem, type StationTest } from "@/lib/station/store";
import { consumablePresets } from "@/lib/purchasing/presets";
import { NumberInput } from "@/components/local/NumberInput";
import { qcLinks } from "@/lib/local/links";
import { getSettings, getKits, saveKits, type PurchasingSettings, type Kit } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";
import { TestPicker, inp, Modal, Chips } from "./stockParts";

type Tab = "items" | "tests";
/** A reagent is taken with the results (one per test); a supply is issued by the examiner. */
type Kind = "reagent" | "supply";
const blank = { name: "", qty: "", minQty: "", expiry: "", testIds: [] as string[], kind: "reagent" as Kind, price: "", barcode: "" };
/** The name a test's own material gets when made from «الأصناف». */
const materialName = (t: StationTest) => `كاشف ${t.name_ar}`;

/**
 * «الأصناف»: what the stock room holds, in sections — reagents (taken with the results), supplies
 * (tubes, syringes, gloves… issued by the examiner), control materials, and kits (packages bought as
 * one). Each item shows the kits it comes in. A second tab lists the lab's tests and their materials.
 */
export function ItemsPanel() {
  const [rows, setRows] = useState<StockItem[]>([]);
  const [tests, setTests] = useState<StationTest[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [qc, setQc] = useState<Map<string, string[]>>(new Map());
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [tab, setTab] = useState<Tab>("items");
  const [q, setQ] = useState("");
  /** The item being edited, or the kind of a new one. */
  const [editing, setEditing] = useState<StockItem | Kind | null>(null);
  const [kitEditing, setKitEditing] = useState<Kit | "new" | null>(null);

  useEffect(() => {
    const list = getStock();
    setRows(list); setTests(getTests()); setKits(getKits()); setQc(qcLinks()); setOpts(getSettings());
    // «المخزن» links here: ?edit=<id> opens that item, ?new=1 a new one.
    const u = new URLSearchParams(window.location.search);
    const s = list.find((x) => x.id === u.get("edit"));
    if (s) setEditing(s); else if (u.get("new")) setEditing("reagent");
  }, []);

  function persist(next: StockItem[]) { setRows(next); saveStock(next); }
  function saveItem(rec: StockItem) { persist(rows.some((r) => r.id === rec.id) ? rows.map((r) => (r.id === rec.id ? rec : r)) : [...rows, rec]); setEditing(null); }
  function delItem(id: string) {
    const inKits = kits.filter((k) => k.parts.some((p) => p.stockId === id));
    if (!window.confirm(`حذف هذا الصنف من المخزن؟${inKits.length ? ` (يُحذف أيضاً من: ${inKits.map((k) => k.name).join("، ")})` : ""}`)) return;
    persist(rows.filter((r) => r.id !== id)); setEditing(null);
    if (inKits.length) persistKits(kits.map((k) => ({ ...k, parts: k.parts.filter((p) => p.stockId !== id) })));
  }
  function persistKits(next: Kit[]) { setKits(next); saveKits(next); }
  /** A kit saved from its window, with any items typed there that were not in the stock room yet. */
  function saveKit(k: Kit, added: StockItem[]) {
    if (added.length) persist([...rows, ...added]);
    persistKits(kits.some((x) => x.id === k.id) ? kits.map((x) => (x.id === k.id ? k : x)) : [...kits, k]);
    setKitEditing(null);
  }

  // Per test: its reagents (one unit per test) and the supplies used with it (issued by hand).
  const { own, supplies } = useMemo(() => {
    const own = new Map<string, StockItem[]>(), supplies = new Map<string, StockItem[]>();
    for (const s of rows) for (const id of stockTestIds(s)) {
      const m = isByHand(s) ? supplies : own;
      m.set(id, [...(m.get(id) ?? []), s]);
    }
    return { own, supplies };
  }, [rows]);
  const missing = tests.filter((t) => !own.has(t.id));
  /** Per item: the kits it comes in, with how many. */
  const inKits = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of kits) for (const p of k.parts) m.set(p.stockId, [...(m.get(p.stockId) ?? []), `${k.name} × ${p.qty}`]);
    return m;
  }, [kits]);

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
  /** The lab's common supplies (missing ones only), issued by the examiner. */
  function addPresets() {
    const have = new Set(rows.map((r) => r.name.trim()));
    const add = consumablePresets(tests).filter((p) => !have.has(p.name))
      .map((p): StockItem => ({ id: uid(), name: p.name, qty: 0, ...(p.testIds.length ? { testIds: p.testIds } : {}), byHand: true }));
    if (!add.length) { window.alert("المستلزمات الشائعة موجودة."); return; }
    persist([...rows, ...add]);
  }

  const term = q.trim().toLowerCase();
  const testNames = (s: StockItem) => stockTestIds(s).map((id) => tests.find((t) => t.id === id)?.name_ar).filter(Boolean) as string[];
  const match = (s: StockItem) => !term || s.name.toLowerCase().includes(term);
  const sections: { key: string; title: string; hint: string; icon: ReactNode; items: StockItem[]; always?: boolean; foot?: ReactNode }[] = [
    { key: "reagents", title: "الكواشف", hint: "تُحسم مع النتائج: وحدة لكل تحليل مرتبط.", icon: <FlaskConical className="size-4 text-amber-700" />,
      items: rows.filter((s) => !isByHand(s) && !(qc.has(s.id) && !stockTestIds(s).length) && match(s)), always: rows.length === 0 },
    { key: "supplies", title: "المستلزمات", hint: "أنابيب، سرنجات، علب، قفازات… يصرفها الفاحص بنفسه من «المخزن» (أنبوب أو سرنجة واحدة قد تكفي عدة تحاليل).",
      icon: <Syringe className="size-4 text-sky-700" />, items: rows.filter((s) => isByHand(s) && match(s)), always: !term,
      foot: (
        <div className="flex flex-wrap gap-3 border-t border-line px-4 py-2.5 text-sm">
          <button onClick={() => setEditing("supply")} data-testid="supply-new" className="inline-flex items-center gap-1 text-sky-700 hover:underline"><Plus className="size-4" /> مستلزم جديد</button>
          <button onClick={addPresets} data-testid="stock-presets" className="inline-flex items-center gap-1 text-amber-700 hover:underline"><PackagePlus className="size-4" /> إضافة المستلزمات الشائعة (أنابيب، سرنجة، علب، قفازات…)</button>
        </div>
      ) },
    { key: "qc", title: "مواد السيطرة", hint: "مرتبطة بالجودة: تُحسم مع إدخالات السيطرة.", icon: <ShieldCheck className="size-4 text-rose-700" />,
      items: rows.filter((s) => !isByHand(s) && qc.has(s.id) && !stockTestIds(s).length && match(s)) },
  ];
  const shownTests = tests.filter((t) => !term || t.name_ar.toLowerCase().includes(term) || (t.name_en ?? "").toLowerCase().includes(term) || (t.code ?? "").toLowerCase().includes(term));
  const shownKits = kits.filter((k) => !term || k.name.toLowerCase().includes(term));
  const nameOf = (id: string) => rows.find((s) => s.id === id)?.name ?? "صنف محذوف";
  const btn = "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold";
  const card = "overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]";
  const head = (icon: ReactNode, title: string, n: number, hint: string) => (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line bg-canvas/60 px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 font-bold">{icon} {title}</span>
      <span className="text-xs tabular-nums text-muted">({n})</span>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search className="size-5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" aria-label="بحث في الأصناف" className="w-full bg-transparent py-2.5 text-base outline-none" />
        </label>
        <button onClick={() => setEditing("reagent")} data-testid="item-new" className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}><Plus className="size-4" /> صنف جديد</button>
        <button onClick={() => setKitEditing("new")} data-testid="kit-new" className={`${btn} border border-violet-300 text-violet-700 hover:bg-violet-50`}><Package className="size-4" /> كت جديد</button>
      </div>
      <Chips label="العرض" value={tab} onChange={setTab} options={[["items", "الأصناف والكتات", rows.length + kits.length], ["tests", "التحاليل وموادها", tests.length]]} />

      {tab === "items" && (
        <div className="flex flex-col gap-4" data-testid="items-list">
          {sections.filter((sec) => sec.items.length > 0 || sec.always).map((sec) => (
            <section key={sec.key} data-section={sec.key} className={card}>
              {head(sec.icon, sec.title, sec.items.length, sec.hint)}
              {sec.items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">{rows.length ? "لا شيء هنا بعد." : "لا أصناف بعد — «صنف جديد»، أو أضف المستلزمات الشائعة."}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-line text-right text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">الصنف</th>
                      <th className="px-4 py-2 font-medium">يُستعمل في</th>
                      <th className="w-24 px-4 py-2 font-medium">الكمية</th>
                      <th className="w-24 px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map((s) => {
                      const n = testNames(s);
                      const k = inKits.get(s.id);
                      return (
                        <tr key={s.id} data-item={s.name} className="border-b border-line last:border-0 hover:bg-canvas">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold">{s.name}</div>
                            {k && <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-violet-700" data-testid="item-kits"><Package className="size-3" /> يأتي في: {k.join("، ")}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted" title={n.join("، ")}>
                            {n.length ? (n.length <= 2 ? n.join("، ") : `${n.length} تحليل`) : qc.has(s.id) ? `سيطرة: ${qc.get(s.id)!.join("، ")}` : "—"}
                          </td>
                          <td className={`px-4 py-2.5 font-semibold tabular-nums ${(Number(s.qty) || 0) <= 0 ? "text-red-600" : ""}`} dir="ltr" style={{ textAlign: "right" }}>{s.qty}</td>
                          <td className="px-4 py-2.5">
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
              )}
              {sec.foot}
            </section>
          ))}

          {(shownKits.length > 0 || !term) && (
            <section data-section="kits" data-testid="items-kits" className={card}>
              {head(<Package className="size-4 text-violet-600" />, "الكتات", shownKits.length, "علبة تُشترى مرة واحدة وتحتوي أصنافاً — عند شرائها في «المشتريات» تُضاف محتوياتها إلى المخزن.")}
              {shownKits.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">لا كتات بعد — <button onClick={() => setKitEditing("new")} className="text-violet-700 underline">كت جديد</button>.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {shownKits.map((k) => (
                    <li key={k.id} data-kit={k.name} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="min-w-40 flex-1">
                        <div className="font-semibold">{k.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {k.parts.map((p) => <span key={p.stockId} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800">{nameOf(p.stockId)} × <b dir="ltr">{p.qty}</b></span>)}
                        </div>
                      </div>
                      <button onClick={() => setKitEditing(k)} aria-label={`تعديل ${k.name}`} className="grid size-8 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                      <button onClick={() => { if (window.confirm("حذف هذا الكت؟ الأصناف نفسها تبقى.")) persistKits(kits.filter((x) => x.id !== k.id)); }} aria-label={`حذف ${k.name}`}
                        className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {tab === "tests" && (
        <div className={card} data-testid="items-tests">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
            تحاليل «إدارة الفحوصات» في محطة المختبر: الكاشف الذي يُحسم منه كل تحليل <span className="rounded-full bg-amber-50 px-2 text-amber-800">كاشف</span> والمستلزمات التي يُستعمل معها <span className="rounded-full bg-sky-50 px-2 text-sky-700">يصرفها الفاحص</span>.
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
                const mats = [...(own.get(t.id) ?? []), ...(supplies.get(t.id) ?? [])];
                const priced = (own.get(t.id) ?? []).filter((m) => m.price != null);
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
                            <button key={m.id} onClick={() => setEditing(m)} className={`rounded-full px-2 py-0.5 text-xs hover:underline ${isByHand(m) ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"}`}>
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

      {editing && (
        <ItemDialog item={typeof editing === "string" ? null : editing} kind={typeof editing === "string" ? editing : undefined} tests={tests} opts={opts}
          onClose={() => setEditing(null)} onSave={saveItem} onDelete={typeof editing === "string" ? undefined : () => delItem(editing.id)} />
      )}
      {kitEditing && (
        <KitDialog kit={kitEditing === "new" ? null : kitEditing} stock={rows} barcode={opts.barcode === true} onClose={() => setKitEditing(null)} onSave={saveKit} />
      )}
    </div>
  );
}

/** «صنف جديد» / editing an item: name, kind (reagent or supply), quantity; the rest only when wanted. */
function ItemDialog({ item, kind, tests, opts, onClose, onSave, onDelete }: {
  item: StockItem | null; kind?: Kind; tests: StationTest[]; opts: PurchasingSettings; onClose: () => void; onSave: (s: StockItem) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState(() => item ? {
    name: item.name, qty: String(item.qty), minQty: item.minQty != null ? String(item.minQty) : "", expiry: item.expiry ?? "",
    testIds: stockTestIds(item), kind: (isByHand(item) ? "supply" : "reagent") as Kind, price: item.price != null ? String(item.price) : "", barcode: item.barcode ?? "",
  } : { ...blank, kind: kind ?? "reagent" });
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
      byHand: f.kind === "supply" || undefined,
    });
  }
  const kindBtn = (k: Kind, title: string, hint: string) => (
    <button type="button" onClick={() => setF({ ...f, kind: k })} aria-pressed={f.kind === k}
      className={`flex-1 rounded-xl border px-3 py-2 text-start ${f.kind === k ? (k === "supply" ? "border-sky-500 bg-sky-50" : "border-amber-500 bg-amber-50") : "border-line hover:bg-canvas"}`}>
      <span className="block text-sm font-semibold">{title}</span><span className="block text-[11px] text-muted">{hint}</span>
    </button>
  );
  const supply = f.kind === "supply";
  return (
    <Modal title={item ? `تعديل: ${item.name}` : supply ? "مستلزم جديد" : "صنف جديد"} onClose={onClose} testid="item-form" wide>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
        <label className="text-sm font-medium">اسم الصنف *<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus className={`mt-1 ${inp} text-base`} /></label>
        <div className="flex gap-2">
          {kindBtn("reagent", "كاشف / مادة", "يُحسم مع النتائج: وحدة لكل تحليل")}
          {kindBtn("supply", "مستلزم", "أنبوب، سرنجة، قفازات… يصرفه الفاحص بنفسه")}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">الكمية<NumberInput value={f.qty} onValue={(v) => setF({ ...f, qty: v })} aria-label="الكمية" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">تنبيه عند<NumberInput value={f.minQty} onValue={(v) => setF({ ...f, minQty: v })} aria-label="الحد الأدنى للتنبيه" placeholder="اختياري" className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">ينتهي في<input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} aria-label="تاريخ الانتهاء" className={`mt-1 ${inp}`} /></label>
          {opts.prices && <label className="text-sm font-medium">سعر الوحدة<NumberInput value={f.price} onValue={(v) => setF({ ...f, price: v })} group aria-label="سعر الوحدة" className={`mt-1 ${inp}`} /></label>}
          {opts.barcode && <label className="text-sm font-medium sm:col-span-2">الباركود<input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} aria-label="باركود الصنف" placeholder="امسح باركود العلبة هنا" dir="ltr" className={`mt-1 ${inp}`} /></label>}
        </div>
        <details className="rounded-xl border border-line" open={f.testIds.length > 0}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            التحاليل التي {supply ? "يُستعمل معها" : "تستعمله"} {f.testIds.length > 0 && <span className="text-amber-700">({f.testIds.length})</span>}
            <span className="text-xs font-normal text-muted"> — {supply ? "للعرض فقط، لا يُحسم تلقائياً" : "ليُحسم منه تلقائياً"}</span>
          </summary>
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

type Part = { name: string; qty: string };
/** «كت جديد» / editing a kit: its name and what it holds. A part is typed by name (suggested from the
 *  stock room); a name not there yet becomes a new item (quantity 0) when the kit is saved. */
function KitDialog({ kit, stock, barcode, onClose, onSave }: {
  kit: Kit | null; stock: StockItem[]; barcode: boolean; onClose: () => void; onSave: (k: Kit, added: StockItem[]) => void;
}) {
  const [name, setName] = useState(kit?.name ?? "");
  const [code, setCode] = useState(kit?.barcode ?? "");
  const nameOf = (id: string) => stock.find((s) => s.id === id)?.name ?? "";
  const [parts, setParts] = useState<Part[]>(kit?.parts.length ? kit.parts.map((p) => ({ name: nameOf(p.stockId), qty: String(p.qty) })) : [{ name: "", qty: "1" }]);
  const [err, setErr] = useState("");
  const setPart = (i: number, patch: Partial<Part>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const find = (n: string) => stock.find((s) => s.name.trim().toLowerCase() === n.trim().toLowerCase());
  function submit() {
    const filled = parts.filter((p) => p.name.trim() && (Number(p.qty) || 0) > 0);
    if (!name.trim()) { setErr("اكتب اسم الكت."); return; }
    if (!filled.length) { setErr("اكتب صنفاً واحداً على الأقل وكميته في الكت."); return; }
    if (find(name)) { setErr("هذا الاسم لصنف — اختر اسماً آخر للكت."); return; }
    const added: StockItem[] = [];
    const clean = filled.map((p) => {
      let s = find(p.name) ?? added.find((a) => a.name.toLowerCase() === p.name.trim().toLowerCase());
      if (!s) { s = { id: uid(), name: p.name.trim(), qty: 0 }; added.push(s); }
      return { stockId: s.id, qty: Number(p.qty) };
    });
    onSave({ id: kit?.id ?? uid(), name: name.trim(), parts: clean, ...(barcode ? (code.trim() ? { barcode: code.trim() } : {}) : kit?.barcode ? { barcode: kit.barcode } : {}) }, added);
  }
  return (
    <Modal title={kit ? `تعديل: ${kit.name}` : "كت جديد"} onClose={onClose} testid="kit-form" wide>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم الكت *<input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="اسم الكت" placeholder="مثلاً: كت السكر" className={`mt-1 ${inp} text-base`} /></label>
          {barcode && <label className="text-sm font-medium">باركود الكت<input value={code} onChange={(e) => setCode(e.target.value)} aria-label="باركود الكت" dir="ltr" className={`mt-1 ${inp}`} /></label>}
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">يحتوي <span className="text-xs font-normal text-muted">— اختر صنفاً أو اكتب اسم صنف جديد فيُضاف إلى الأصناف</span></div>
          <datalist id="kit-stock-names">{stock.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          <div className="flex flex-col gap-2">
            {parts.map((p, i) => {
              const isNew = p.name.trim() !== "" && !find(p.name);
              return (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-center gap-2">
                  <div className="relative">
                    <input value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} list="kit-stock-names" aria-label="صنف في الكت" placeholder="اسم الصنف" className={`${inp} pe-14`} />
                    {isNew && <span data-testid="kit-part-new" className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">جديد</span>}
                  </div>
                  <NumberInput value={p.qty} onValue={(v) => setPart(i, { qty: v })} aria-label="الكمية في الكت" placeholder="العدد" className={inp} />
                  <button type="button" onClick={() => setParts((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps))} aria-label="حذف من الكت"
                    className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><X className="size-4" /></button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setParts((ps) => [...ps, { name: "", qty: "1" }])} className="mt-2 inline-flex items-center gap-1 text-sm text-amber-700 hover:underline"><Plus className="size-4" /> صنف آخر في الكت</button>
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
