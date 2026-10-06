"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X, Copy, Package, Boxes, ShoppingCart, PackagePlus } from "lucide-react";
import {
  addPurchase, addToStock, deviceNames, getKits, getPurchases, getSettings, getSuppliers, lineTotal, savePurchases, stockMatch, uid,
  type Kit, type Purchase, type PurchaseItem, type PurchasingSettings, type Supplier,
} from "@/lib/purchasing/store";
import { getStock, type StockItem } from "@/lib/station/store";
import { parseGs1 } from "@/lib/purchasing/gs1";
import { CameraScan } from "@/components/local/CameraScan";
import { NumberInput } from "@/components/local/NumberInput";
import { money } from "@/lib/utils";
import { ScanBox } from "./stockParts";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand";
const num = `${inp} tabular-nums text-left`;
const today = () => new Date().toLocaleDateString("en-CA"); // local date, not UTC
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A line being typed: a stock item or a kit (two separate lists), how many, expiry and lot (optional),
 *  the price of one and the line's total (either one fills the other). */
type LineKind = "item" | "kit";
interface Row { kind: LineKind; device: string; name: string; qty: number; perKit: number; expiry: string; lot: string; unit: number; total: number; gtin?: string }
const blank = (kind: LineKind = "item", device = ""): Row => ({ kind, device, name: "", qty: 1, perKit: 0, expiry: "", lot: "", unit: 0, total: 0 });

/**
 * «عملية شراء جديدة» — the entry into the lab's stock room, on the page itself (as in the supplier
 * station), as a table of lines: paid or not (or an ordered purchase that arrives later), then each
 * line's kind (item / kit) · device · material · count · expiry · lot (optional) · price of one ·
 * total. The supplier with his invoice number, and the date (otherwise today's), show only when
 * switched on in the station's settings («خيارات إضافية»); supplier debts always show the supplier. A known material shows its balance; a new one is added to the
 * stock room on saving; a kit adds its contents. A GS1 box code (scanner or camera) fills the lot and
 * expiry (Settings → «الباركود»). Supplier debts (Settings → «ديون الموردين») replace «مدفوعة» with
 * «المدفوع الآن».
 */
export function PurchaseForm({ onSaved }: { onSaved?: (msg: string) => void }) {
  const [dateTyped, setDate] = useState(today());
  const [supplier, setSupplier] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [paid, setPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [ordered, setOrdered] = useState(false);
  /** «شراء من مورّد» (a purchase) or «رصيد افتتاحي / تسوية» (into the stock room only, as in the supplier station). */
  const [entry, setEntry] = useState<"purchase" | "opening">("purchase");
  const purchase = entry === "purchase";
  const [toStock, setToStock] = useState(true);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [err, setErr] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const box = useRef<HTMLDivElement>(null);

  const load = () => { setDevices(deviceNames()); setSuppliers(getSuppliers()); setStock(getStock()); setKits(getKits()); setOpts(getSettings()); };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's data (browser storage) is read once the page is on screen, never while rendering on the server
    load();
  }, []);

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const kitOf = (name: string) => (name.trim() ? kits.find((k) => same(k.name, name)) : undefined);
  const itemOf = (name: string) => (name.trim() ? stock.find((s) => same(s.name, name)) : undefined);
  const nameOf = (id: string) => stock.find((s) => s.id === id)?.name ?? "؟";
  const kitText = (k: Kit, times = 1) => k.parts.map((p) => `${nameOf(p.stockId)} × ${p.qty * times}`).join("، ");
  /** The materials offered on a line: those saved for its device (all of them while it has none);
   *  a new material is still typed by hand. */
  const stockFor = (device: string) => (device.trim() ? stock.filter((s) => same(s.device ?? "", device)) : stock);
  /** The kits offered: those holding a material of that device (all of them while it has none). */
  const kitsFor = (device: string) => (device.trim() ? kits.filter((k) => k.parts.some((p) => same(stock.find((s) => s.id === p.stockId)?.device ?? "", device))) : kits);
  /** A defined kit of one material: the units it holds. */
  const kitUnits = (k: Kit) => (k.parts.length === 1 ? k.parts[0].qty : 0);
  const total = rows.reduce((t, r) => t + (Number(r.total) || 0), 0);
  const purchaseDebts = opts.debts === true;
  const showSupplier = purchase && (opts.supplierFields === true || purchaseDebts);
  const showDate = purchase && opts.showDate === true;

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, ...patch };
    // A known item typed without its device: the device written on it.
    if (patch.name !== undefined && next.kind === "item" && !next.device.trim()) next.device = itemOf(next.name)?.device ?? "";
    return next;
  }));
  /** The count, the price of one and the total stay in step: a changed count keeps the price of one. */
  const setQty = (i: number, qty: number) => setRows((rs) => rs.map((r, j) => (j !== i ? r : { ...r, qty, ...(r.unit > 0 ? { total: round2(r.unit * qty) } : { unit: qty > 0 ? round2(r.total / qty) : 0 }) })));
  const setUnit = (i: number, unit: number) => setRows((rs) => rs.map((r, j) => (j !== i ? r : { ...r, unit, total: round2(unit * (Number(r.qty) || 0)) })));
  const setTotal = (i: number, t: number) => setRows((rs) => rs.map((r, j) => (j !== i ? r : { ...r, total: t, unit: Number(r.qty) > 0 ? round2(t / Number(r.qty)) : r.unit })));
  function addRow(after?: number) {
    setRows((rs) => {
      // «سطر آخر» after a line: the same kind and device.
      const row = after != null ? blank(rs[after].kind, rs[after].device) : blank();
      return after == null ? [...rs, row] : [...rs.slice(0, after + 1), row, ...rs.slice(after + 1)];
    });
    setTimeout(() => box.current?.querySelectorAll<HTMLInputElement>("input[data-line-name]").forEach((el, i, all) => { if (i === (after == null ? all.length - 1 : after + 1)) el.focus(); }), 30);
  }
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]));

  /** A scanned item or kit becomes a line (or one more of it); a GS1 box code also fills its lot and
   *  expiry, and one not known yet starts a line that remembers the code once it is named and saved. */
  function onScan(raw: string): string {
    const g = parseGs1(raw);
    const code = g?.gtin ?? raw;
    const k = kits.find((x) => x.barcode === code || x.barcode === raw);
    const hit = k?.name ?? stock.find((s) => s.barcode === code || s.barcode === raw)?.name;
    const batch = { ...(g?.lot ? { lot: g.lot } : {}), ...(g?.expiry ? { expiry: g.expiry } : {}) };
    if (!hit) {
      if (!g || !(g.lot || g.expiry)) return `باركود غير معروف: ${raw}`;
      setRows((rs) => {
        const at = rs.findIndex((r) => !r.name.trim() && !r.lot.trim());
        const line = { ...blank(), ...batch, ...(g.gtin ? { gtin: g.gtin } : {}) };
        return at >= 0 ? rs.map((r, j) => (j === at ? { ...r, ...line } : r)) : [...rs, line];
      });
      return "علبة جديدة: اكتب اسم الصنف ليُحفظ باركودها";
    }
    const kind: LineKind = k ? "kit" : "item";
    setRows((rs) => {
      const i = rs.findIndex((r) => r.kind === kind && same(r.name, hit) && (!batch.lot || !r.lot || r.lot === batch.lot));
      if (i >= 0) return rs.map((r, j) => { if (j !== i) return r; const qty = (Number(r.qty) || 0) + 1; return { ...r, ...batch, qty, ...(r.unit > 0 ? { total: round2(r.unit * qty) } : {}) }; });
      const at = rs.findIndex((r) => !r.name.trim());
      return at >= 0 ? rs.map((r, j) => (j === at ? { ...r, ...batch, kind, name: hit, qty: 1 } : r)) : [...rs, { ...blank(kind), ...batch, name: hit }];
    });
    return `أُضيف: ${hit}`;
  }
  // The camera calls back later: through a ref kept on the latest reader (it sees the current lines).
  const scanRef = useRef(onScan);
  useEffect(() => { scanRef.current = onScan; });
  const cameraScan = useCallback((raw: string) => { setScanMsg(scanRef.current(raw)); }, []);

  function save() {
    setErr("");
    const clean = rows.filter((r) => r.name.trim());
    if (!clean.length) return setErr("اكتب صنفاً أو كتاً واحداً على الأقل.");
    // A kit line: a defined kit, or a material bought by the kit with how many units one kit holds.
    const unknownKit = clean.find((r) => r.kind === "kit" && !kitOf(r.name) && !(Number(r.perKit) > 0));
    if (unknownKit) return setErr(`اكتب «عدد في الكت» لـ «${unknownKit.name.trim()}» — كم وحدة في الكت الواحد.`);
    const kitAsItem = clean.find((r) => r.kind === "item" && kitOf(r.name));
    if (kitAsItem) return setErr(`«${kitAsItem.name.trim()}» اسم كت — اختر «كت» لهذا البند.`);
    const sup = showSupplier ? suppliers.find((s) => same(s.name, supplier)) : undefined;
    const date = showDate && dateTyped ? dateTyped : today();
    const lines = clean.map((r): PurchaseItem => {
      const kit = r.kind === "kit" ? kitOf(r.name) : undefined;
      const qty = Number(r.qty) || 0, t = Number(r.total) || 0;
      return {
        ...(r.device.trim() ? { device: r.device.trim().slice(0, 120) } : {}),
        name: kit?.name ?? stockMatch(r.name)?.name ?? r.name.trim(), qty, unitPrice: qty > 0 ? round2(t / qty) : 0, total: t,
        ...(kit ? { kitId: kit.id } : r.kind === "kit" && Number(r.perKit) > 0 ? { perKit: Math.round(Number(r.perKit)) } : {}),
        ...(r.expiry ? { expiry: r.expiry } : {}), ...(r.lot.trim() ? { lot: r.lot.trim() } : {}), ...(r.gtin ? { gtin: r.gtin } : {}),
      };
    });
    const sum = lines.reduce((t, it) => t + lineTotal(it), 0);
    if (!purchase) {
      // An opening balance / adjustment: into the stock room only — not a purchase, spending or debt.
      const added = addToStock(lines, notes.trim() ? `رصيد افتتاحي / تسوية — ${notes.trim().slice(0, 80)}` : "رصيد افتتاحي / تسوية", "add");
      onSaved?.(`دخلت ${added.length} مادة إلى المخزن (رصيد افتتاحي / تسوية).`);
      setRows([blank()]); setNotes(""); setScanMsg(""); load();
      return;
    }
    // Supplier debts: what is paid now; the rest stays owed. An ordered purchase has paid nothing yet.
    const payNow = purchaseDebts && !ordered ? Math.min(Number(paidAmount) || 0, sum) : 0;
    const p: Purchase = {
      id: uid(), created_at: Date.now(), date,
      supplierId: sup?.id, supplierName: showSupplier ? sup?.name || supplier.trim() || undefined : undefined,
      ...(showSupplier && supplierRef.trim() ? { supplierRef: supplierRef.trim().slice(0, 60) } : {}), ...(ordered ? { ordered: true } : {}),
      items: lines, total: sum, paid: ordered ? false : purchaseDebts ? payNow >= sum : paid, notes: notes.trim() || undefined,
      ...(payNow > 0 ? { payments: [{ id: uid(), date, amount: payNow }] } : {}),
    };
    if (!addPurchase(p)) return setErr("تعذّر الحفظ: مساحة التخزين في المتصفح ممتلئة — خذ نسخة احتياطية من الإعدادات.");
    // An ordered purchase brings nothing into the stock room until «استلام».
    let n = 0;
    if (toStock && !ordered) {
      const added = addToStock(lines, [p.supplierName, date].filter(Boolean).join(" · "));
      n = added.length;
      if (added.length) savePurchases(getPurchases().map((x) => (x.id === p.id ? { ...x, stockAdded: added } : x)));
    }
    onSaved?.(`حُفظت العملية: ${money(sum)} د.ع${ordered ? " — بانتظار الاستلام" : n ? ` — وأُضيفت ${n} مادة إلى المخزن` : ""}`);
    setRows([blank()]); setNotes(""); setPaid(false); setPaidAmount(0); setSupplierRef(""); setOrdered(false); setScanMsg("");
    load();
  }

  return (
    <div data-testid="purchase-form" ref={box}>
      <div className="mb-3 flex w-fit overflow-hidden rounded-lg border border-line text-sm" role="tablist" aria-label="نوع الإدخال">
        {([["purchase", "شراء من مورّد", ShoppingCart], ["opening", "رصيد افتتاحي / تسوية", PackagePlus]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={entry === k} data-testid={`entry-kind-${k}`} onClick={() => setEntry(k)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 ${entry === k ? "bg-amber-600 font-semibold text-white" : "bg-surface hover:bg-canvas"}`}><Icon className="size-4" /> {l}</button>
        ))}
      </div>
      {purchase ? <>
      <div className={`grid items-end gap-3 ${showSupplier ? (showDate ? "sm:grid-cols-[1.4fr_1fr_0.9fr_auto]" : "sm:grid-cols-[1.4fr_1fr_auto]") : showDate ? "sm:grid-cols-[0.9fr_auto]" : "sm:grid-cols-[auto]"}`}>
        {showSupplier && <>
          <label className="text-sm font-medium">اسم المورّد
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="pf-suppliers" placeholder="اختر أو اكتب اسم المورّد" aria-label="المورّد" className={`mt-1 ${inp}`} />
            <datalist id="pf-suppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </label>
          <label className="text-sm font-medium">رقم فاتورة المورّد <span className="font-normal text-muted">(اختياري)</span>
            <input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} dir="ltr" aria-label="رقم فاتورة المورّد" className={`mt-1 ${inp}`} />
          </label>
        </>}
        {showDate && <label className="text-sm font-medium">التاريخ<input type="date" value={dateTyped} onChange={(e) => setDate(e.target.value)} aria-label="تاريخ الشراء" className={`mt-1 ${inp}`} /></label>}
        {ordered ? (
          <span className="pb-2 text-xs text-amber-700">طلبية — لا مصروف ولا دين حتى «استلام»</span>
        ) : purchaseDebts ? (
          <label className="text-sm font-medium">المدفوع الآن
            <NumberInput value={paidAmount} onValue={(v) => setPaidAmount(Number(v) || 0)} group zeroEmpty placeholder="0" aria-label="المدفوع الآن" className={`mt-1 ${num} w-32`} />
          </label>
        ) : (
          <label className="flex items-center gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} aria-label="مدفوعة" className="size-4" /> مدفوعة</label>
        )}
      </div>

      </> : (
        <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">يدخل المخزن فقط — لا يُسجَّل شراءً ولا مصروفاً ولا ديناً لمورّد. للبضاعة المشتراة استعمل «شراء من مورّد».</p>
      )}

      {opts.barcode && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-56 max-w-md flex-1"><ScanBox onScan={(c) => { const m = onScan(c); setScanMsg(m); return m; }} hint="امسح باركود الصنف أو الكت (GS1 يملأ اللوت والاكسباير)…" /></div>
          <CameraScan onCode={cameraScan} />
          {scanMsg && <span className="text-xs text-amber-800" role="status" data-testid="scan-msg">{scanMsg}</span>}
        </div>
      )}

      <datalist id="pf-devices">{devices.map((d) => <option key={d} value={d} />)}</datalist>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[940px] text-sm" data-testid="purchase-lines">
          <thead className="text-right text-xs text-muted">
            <tr>
              <th className="w-8 pb-1 font-medium">ت</th><th className="w-24 pb-1 font-medium">النوع</th><th className="min-w-28 pb-1 font-medium">الجهاز <span className="font-normal">(اختياري)</span></th><th className="min-w-36 pb-1 font-medium">المادة *</th>
              <th className="w-16 pb-1 font-medium">العدد</th><th className="w-36 pb-1 font-medium">الإكسباير <span className="font-normal">(اختياري)</span></th><th className="w-24 pb-1 font-medium">اللوت <span className="font-normal">(اختياري)</span></th>
              <th className="w-24 pb-1 font-medium">سعر الواحد</th><th className="w-28 pb-1 font-medium">المجموع</th><th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const kit = r.kind === "kit" ? kitOf(r.name) : undefined;
              const item = r.kind === "item" ? itemOf(r.name) : undefined;
              // A kit: the units one kit holds — from its definition, or typed for a material bought by the kit.
              const per = kit ? kitUnits(kit) : r.kind === "kit" ? Number(r.perKit) || 0 : 0;
              const unitName = kit ? (kit.parts.length === 1 ? nameOf(kit.parts[0].stockId) : "") : r.name.trim();
              const one = per > 0 && r.total > 0 && r.qty > 0 ? `سعر الواحد (${unitName}): ${money(round2(r.total / (per * r.qty)))} د.ع` : null;
              const options = r.kind === "kit"
                ? [...kitsFor(r.device).map((k) => ({ id: k.id, name: k.name, hint: kitText(k) })), ...stockFor(r.device).map((s) => ({ id: s.id, name: s.name, hint: "مادة — اكتب عدد في الكت" }))]
                : stockFor(r.device).map((s) => ({ id: s.id, name: s.name, hint: "" }));
              return (
                <tr key={i} data-line={i} className="align-top">
                  <td className="pe-1.5 pb-2 pt-2 text-center text-xs tabular-nums text-muted">{i + 1}</td>
                  <td className="pe-1.5 pb-2">
                    <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="نوع البند">
                      {(["item", "kit"] as const).map((k) => (
                        <button key={k} type="button" onClick={() => set(i, { kind: k })} aria-pressed={r.kind === k} data-line-kind={k}
                          className={`flex-1 px-2 py-2 text-xs font-semibold ${r.kind === k ? (k === "kit" ? "bg-violet-600 text-white" : "bg-amber-600 text-white") : "text-muted hover:bg-canvas"}`}>{k === "kit" ? "كت" : "صنف"}</button>
                      ))}
                    </div>
                  </td>
                  <td className="pe-1.5 pb-2"><input value={r.device} onChange={(e) => set(i, { device: e.target.value })} list="pf-devices" placeholder="الجهاز" aria-label="الجهاز" className={inp} /></td>
                  <td className="pe-1.5 pb-2">
                    <datalist id={`pf-names-${i}`} data-testid="line-options">{options.map((o) => <option key={o.id} value={o.name}>{o.hint}</option>)}</datalist>
                    <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} data-line-name list={`pf-names-${i}`}
                      placeholder={r.kind === "kit" ? "الكت" : "الصنف"} aria-label={r.kind === "kit" ? "الكت" : "الصنف"} className={inp} />
                    {r.name.trim() && (r.kind === "kit" ? (kit
                      ? <div className="mt-0.5 flex items-center gap-1 text-[10px] text-violet-700" data-testid="kit-contents"><span data-testid="line-kit" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 font-semibold"><Package className="size-3" /> كت</span> يُضاف إلى المخزن: {kitText(kit, Number(r.qty) || 0)}</div>
                      : <div className="mt-0.5 flex items-center gap-1 text-[10px] text-violet-700" data-testid="kit-contents"><span data-testid="line-kit" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 font-semibold"><Package className="size-3" /> كت</span>
                          {per > 0 ? <>يُضاف إلى المخزن: {r.name.trim()} × {per * (Number(r.qty) || 0)}</> : <span className="font-semibold text-red-700">اكتب «عدد في الكت»</span>}</div>)
                      : item
                        ? <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted" data-testid="line-known"><Boxes className="size-3 text-amber-700" /> في المخزن · الرصيد {item.qty}{item.expiry ? ` · الإكسباير ${item.expiry}` : ""}</div>
                        : <div className="mt-0.5 text-[10px] font-semibold text-sky-700" data-testid="line-new">صنف جديد — يُضاف إلى المخزن عند الحفظ</div>)}
                  </td>
                  <td className="pe-1.5 pb-2">
                    <NumberInput value={r.qty} onValue={(v) => setQty(i, Number(v) || 0)} aria-label="العدد" className={num} />
                    {r.kind === "kit" && (
                      <label className="mt-1 block text-[10px] text-violet-700">عدد في الكت
                        {kit
                          ? <span className="block rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm tabular-nums text-ink" data-testid="kit-units">{per || "—"}</span>
                          : <NumberInput value={r.perKit} onValue={(v) => set(i, { perKit: Number(v) || 0 })} zeroEmpty placeholder="0" aria-label="عدد في الكت" className={num} />}
                      </label>
                    )}
                  </td>
                  <td className="pe-1.5 pb-2"><input type="date" value={r.expiry} onChange={(e) => set(i, { expiry: e.target.value })} aria-label="الاكسباير" className={inp} /></td>
                  <td className="pe-1.5 pb-2"><input value={r.lot} onChange={(e) => set(i, { lot: e.target.value })} dir="ltr" placeholder="LOT" aria-label="اللوت" className={inp} /></td>
                  <td className="pe-1.5 pb-2"><NumberInput value={r.unit} onValue={(v) => setUnit(i, Number(v) || 0)} group zeroEmpty placeholder="0" aria-label="سعر الواحد" className={num} /></td>
                  <td className="pe-1.5 pb-2">
                    <NumberInput value={r.total} onValue={(v) => setTotal(i, Number(v) || 0)} group zeroEmpty placeholder="0" aria-label="المجموع" className={`${num} font-semibold`}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (i === rows.length - 1) addRow(); } }} />
                    {one && <div className="mt-0.5 text-[10px] tabular-nums text-muted" data-testid="line-unit">{one}</div>}
                  </td>
                  <td className="pb-2">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => addRow(i)} title="مادة أخرى لنفس الجهاز" aria-label={`سطر آخر بعد السطر ${i + 1}`} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-canvas"><Copy className="size-3.5" /></button>
                      <button type="button" onClick={() => removeRow(i)} title="حذف السطر" aria-label={`حذف السطر ${i + 1}`} className="grid size-8 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><X className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => addRow()} data-testid="purchase-add-row" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"><Plus className="size-3.5" /> سطر جديد</button>
      <span className="ms-2 text-[11px] text-muted">(أو Enter في خانة المجموع)</span>
      <span className="ms-2 text-[11px] text-muted">— للكت: اختر كتاً معرَّفاً في «الأصناف»، أو مادة واكتب «عدد في الكت».</span>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" aria-label="ملاحظات" className={`mt-3 ${inp}`} />
      {err && <p className="mt-2 text-sm text-red-600" role="alert">{err}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="text-sm">{purchase ? "إجمالي الشراء" : "قيمة الإدخال"}: <b className="tabular-nums text-amber-700" data-testid="purchase-total">{money(total)} د.ع</b></div>
        {purchase && <>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} aria-label="طلبية بانتظار الاستلام" data-testid="purchase-ordered" /> طلبية لم تصل بعد
          </label>
          <label className={`inline-flex items-center gap-1.5 text-xs text-muted ${ordered ? "opacity-50" : ""}`}>
            <input type="checkbox" checked={toStock && !ordered} disabled={ordered} onChange={(e) => setToStock(e.target.checked)} aria-label="إضافة الكميات إلى المخزن" /> إضافة البنود إلى المخزن عند الحفظ
          </label>
        </>}
        <button type="button" onClick={save} data-testid="purchase-save" className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"><Plus className="size-4" /> {purchase ? "حفظ العملية" : "حفظ الإدخال"}</button>
      </div>
    </div>
  );
}
