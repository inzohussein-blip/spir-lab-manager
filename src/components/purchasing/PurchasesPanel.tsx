"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Search, X, Boxes, Package, Wallet, CheckCircle2, ChevronDown } from "lucide-react";
import {
  getPurchases, savePurchases, addPurchase, deletePurchases, getSuppliers, purchaseTotal, uid, stockMatch, addToStock,
  getKits, getSettings, paidOf, dueOf, addPayment, setPaid,
  type Purchase, type PurchaseItem, type Supplier, type Kit, type PurchasingSettings,
} from "@/lib/purchasing/store";
import { getStock, type StockItem } from "@/lib/station/store";
import { NumberInput } from "@/components/local/NumberInput";
import { money } from "@/lib/utils";
import { ScanBox, Modal, Chips, inp } from "./stockParts";

const today = () => new Date().toLocaleDateString("en-CA"); // local date, not UTC
const nowMs = () => Date.now();
type Status = "all" | "unpaid" | "paid";

/**
 * «المشتريات»: the list of purchases (newest first) with what is still unpaid, and «عملية شراء
 * جديدة» — a window with the lines to type. Each unpaid purchase can be marked paid in one click.
 */
export function PurchasesPanel() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [msg, setMsg] = useState("");

  const reload = () => { setPurchases(getPurchases()); setStock(getStock()); };
  useEffect(() => { reload(); setSuppliers(getSuppliers()); setKits(getKits()); setOpts(getSettings()); }, []);

  const isPaid = (p: Purchase) => (opts.debts ? dueOf(p) <= 0 : p.paid);
  const due = (p: Purchase) => (opts.debts ? dueOf(p) : p.paid ? 0 : Number(p.total) || 0);
  const sorted = useMemo(() => [...purchases].sort((a, b) => (a.date === b.date ? b.created_at - a.created_at : a.date < b.date ? 1 : -1)), [purchases]);
  const term = q.trim().toLowerCase();
  const shown = sorted.filter((p) => (status === "all" || (status === "paid") === isPaid(p))
    && (!term || (p.supplierName ?? "").toLowerCase().includes(term) || p.items.some((it) => it.name.toLowerCase().includes(term))));
  const spent = purchases.reduce((s, p) => s + Number(p.total || 0), 0);
  const unpaid = purchases.reduce((s, p) => s + due(p), 0);
  const unpaidCount = purchases.filter((p) => !isPaid(p)).length;

  function markPaid(p: Purchase, paid: boolean) {
    if (!paid && !window.confirm("إرجاع هذه العملية إلى «غير مدفوعة»؟")) return;
    setPaid(p.id, paid); reload();
    setMsg(paid ? `سُجّلت مدفوعة: ${p.supplierName ?? "عملية"} ${p.date}` : "أُعيدت إلى غير مدفوعة.");
  }
  /** Supplier debts: the amount typed, or (left empty) everything still owed. */
  function pay(p: Purchase) {
    const amount = payAmount > 0 ? Math.min(payAmount, dueOf(p)) : dueOf(p);
    if (!(amount > 0)) return;
    addPayment(p.id, amount); reload(); setPayFor(null); setPayAmount(0);
  }
  function remove(p: Purchase) {
    if (!window.confirm(`حذف هذه العملية؟${p.stockAdded?.length ? "\nستُطرح كمياتها من المخزن." : ""}`)) return;
    deletePurchases([p.id]); reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} data-testid="purchase-new"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-amber-700">
          <Plus className="size-5" /> عملية شراء جديدة
        </button>
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
          <Search className="size-5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالمورّد أو الصنف…" aria-label="بحث في المشتريات" className="w-full bg-transparent py-2.5 text-base outline-none" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Chips label="الدفع" value={status} onChange={setStatus}
          options={[["all", "الكل", purchases.length], ["unpaid", "غير مدفوعة", unpaidCount], ["paid", "مدفوعة", purchases.length - unpaidCount]]} />
        <span className="ms-auto text-sm text-muted" data-testid="purchase-totals">
          المصروف <b className="tabular-nums text-ink">{money(spent)}</b> د.ع · غير مدفوع <b className={`tabular-nums ${unpaid ? "text-red-600" : "text-ink"}`}>{money(unpaid)}</b> د.ع
        </span>
      </div>
      {msg && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{purchases.length ? "لا عمليات مطابقة." : "لا عمليات شراء بعد — «عملية شراء جديدة»."}</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="purchases">
            {shown.map((p) => {
              const paid = isPaid(p);
              const names = p.items.map((it) => (it.kitId ? `${it.name} (كت)` : it.name));
              return (
                <li key={p.id} data-purchase={p.id}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button onClick={() => setOpen(open === p.id ? null : p.id)} className="flex min-w-48 flex-1 items-center gap-3 text-start" aria-expanded={open === p.id}>
                      <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open === p.id ? "rotate-180" : ""}`} />
                      <span className="w-24 shrink-0 text-sm tabular-nums text-muted">{p.date}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{p.supplierName ?? "بدون مورّد"}</span>
                        <span className="block truncate text-xs text-muted">{names.slice(0, 3).join("، ")}{names.length > 3 ? ` +${names.length - 3}` : ""}</span>
                      </span>
                    </button>
                    <span className="w-32 text-end text-base font-bold tabular-nums">{money(p.total)} <span className="text-xs font-normal text-muted">د.ع</span></span>
                    <div className="flex w-56 items-center justify-end gap-1.5" data-testid="purchase-due">
                      {paid ? (
                        <button onClick={() => markPaid(p, false)} title="اضغط لإرجاعها إلى غير مدفوعة" className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-brand-dark hover:bg-teal-100">
                          <CheckCircle2 className="size-3.5" /> مدفوعة
                        </button>
                      ) : (
                        <>
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                            {opts.debts && paidOf(p) > 0 ? `متبقٍ ${money(dueOf(p))}` : "غير مدفوعة"}
                          </span>
                          <button onClick={() => markPaid(p, true)} aria-label={`تم الدفع ${p.date}`} className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700">تم الدفع</button>
                          {opts.debts && <button onClick={() => { setPayFor(p.id); setPayAmount(0); setOpen(p.id); }} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"><Wallet className="size-3.5" /> دفعة</button>}
                        </>
                      )}
                    </div>
                    <button onClick={() => remove(p)} aria-label="حذف العملية" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
                  </div>

                  {open === p.id && (
                    <div className="border-t border-line bg-canvas/60 px-4 py-3 text-sm" data-testid="purchase-details">
                      <table className="w-full max-w-2xl">
                        <thead className="text-right text-xs text-muted"><tr><th className="py-1 font-medium">الصنف</th><th className="font-medium">الكمية</th><th className="font-medium">سعر الوحدة</th><th className="font-medium">المجموع</th></tr></thead>
                        <tbody>
                          {p.items.map((it, i) => (
                            <tr key={i} className="border-t border-line/60">
                              <td className="py-1.5">{it.name}{it.kitId && <span className="ms-1 rounded-full bg-violet-50 px-1.5 text-[10px] text-violet-700">كت</span>}</td>
                              <td className="tabular-nums">{it.qty}</td>
                              <td className="tabular-nums">{money(it.unitPrice)}</td>
                              <td className="tabular-nums">{money(Number(it.qty) * Number(it.unitPrice))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {p.notes && <p className="mt-2 text-xs text-muted">ملاحظات: {p.notes}</p>}
                      {opts.debts && (p.payments?.length ?? 0) > 0 && (
                        <p className="mt-2 text-xs text-muted">الدفعات: {p.payments!.map((x) => `${money(x.amount)} (${x.date})`).join("، ")} — المدفوع {money(paidOf(p))}، المتبقي {money(dueOf(p))}</p>
                      )}
                      {opts.debts && payFor === p.id && !paid && (
                        <div className="mt-2 flex items-center gap-2">
                          <NumberInput value={payAmount} onValue={(v) => setPayAmount(Number(v) || 0)} group zeroEmpty placeholder={money(dueOf(p))} aria-label="مبلغ الدفعة" className="w-36 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
                          <button onClick={() => pay(p)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">تسجيل الدفعة</button>
                          <button onClick={() => setPayFor(null)} aria-label="إلغاء" className="text-muted"><X className="size-4" /></button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && (
        <PurchaseDialog suppliers={suppliers} stock={stock} kits={kits} opts={opts} onClose={() => setAdding(false)}
          onSaved={(p) => { setAdding(false); reload(); setMsg(`حُفظت العملية: ${money(p.total)} د.ع${p.stockAdded?.length ? " — وأُضيفت البنود إلى المخزن" : ""}`); }} />
      )}
    </div>
  );
}

type Line = PurchaseItem;
const emptyLine = (): Line => ({ name: "", qty: 1, unitPrice: 0 });

/** «عملية شراء جديدة»: date and supplier, the lines (Enter in the price adds the next line), total, paid. */
function PurchaseDialog({ suppliers, stock, kits, opts, onClose, onSaved }: {
  suppliers: Supplier[]; stock: StockItem[]; kits: Kit[]; opts: PurchasingSettings; onClose: () => void; onSaved: (p: Purchase) => void;
}) {
  const [date, setDate] = useState(today());
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState<Line[]>([emptyLine()]);
  const [paid, setPaidNow] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [toStock, setToStock] = useState(true);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const kitOf = (name: string) => (name.trim() ? kits.find((k) => same(k.name, name)) : undefined);
  const inStock = (name: string) => !!name.trim() && stock.some((s) => same(s.name, name));
  const kitText = (k: Kit, times = 1) => k.parts.map((p) => `${stock.find((s) => s.id === p.stockId)?.name ?? "؟"} × ${p.qty * times}`).join("، ");
  const total = purchaseTotal(items);

  function setItem(i: number, patch: Partial<Line>) { setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it))); }
  function addLine() {
    setItems((a) => [...a, emptyLine()]);
    setTimeout(() => box.current?.querySelectorAll<HTMLInputElement>('input[placeholder="الصنف"]').forEach((el, i, all) => { if (i === all.length - 1) el.focus(); }), 30);
  }
  /** Settings → «الباركود»: a scanned item or kit becomes a line (or one more of it). */
  function onScan(code: string): string {
    const hit = kits.find((k) => k.barcode === code)?.name ?? stock.find((s) => s.barcode === code)?.name;
    if (!hit) return `باركود غير معروف: ${code}`;
    setItems((arr) => {
      const i = arr.findIndex((it) => same(it.name, hit));
      if (i >= 0) return arr.map((it, j) => (j === i ? { ...it, qty: (Number(it.qty) || 0) + 1 } : it));
      const blank = arr.findIndex((it) => !it.name.trim());
      return blank >= 0 ? arr.map((it, j) => (j === blank ? { ...it, name: hit, qty: 1 } : it)) : [...arr, { name: hit, qty: 1, unitPrice: 0 }];
    });
    return `أُضيف: ${hit}`;
  }

  function save() {
    const clean = items.filter((it) => it.name.trim());
    if (!clean.length) { setErr("اكتب صنفاً واحداً على الأقل."); return; }
    const sup = suppliers.find((s) => same(s.name, supplier));
    const lines = clean.map((it): PurchaseItem => {
      const kit = kitOf(it.name);
      return { name: kit?.name ?? stockMatch(it.name)?.name ?? it.name.trim(), qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, ...(kit ? { kitId: kit.id } : {}) };
    });
    const sum = purchaseTotal(clean);
    // Supplier debts: what is paid now; the rest stays owed.
    const payNow = opts.debts ? Math.min(Number(paidAmount) || 0, sum) : 0;
    const p: Purchase = {
      id: uid(), created_at: nowMs(), date,
      supplierId: sup?.id, supplierName: sup?.name || supplier.trim() || undefined,
      items: lines, total: sum, paid: opts.debts ? payNow >= sum : paid, notes: notes.trim() || undefined,
      ...(opts.debts && payNow > 0 ? { payments: [{ id: uid(), date, amount: payNow }] } : {}),
    };
    if (!addPurchase(p)) { setErr("تعذّر الحفظ: مساحة التخزين في المتصفح ممتلئة — خذ نسخة احتياطية من الإعدادات."); return; }
    if (toStock) {
      const added = addToStock(lines, [p.supplierName, date].filter(Boolean).join(" · "));
      if (added.length) { p.stockAdded = added; savePurchases(getPurchases().map((x) => (x.id === p.id ? { ...x, stockAdded: added } : x))); }
    }
    onSaved(p);
  }

  return (
    <Modal title="عملية شراء جديدة" onClose={onClose} testid="purchase-form" wide>
      <div ref={box} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">المورّد
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="supplier-list" placeholder="اختر أو اكتب اسم المورّد" aria-label="المورّد" className={`mt-1 ${inp}`} />
            <datalist id="supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </label>
        </div>

        {opts.barcode && <ScanBox onScan={onScan} hint="امسح باركود الصنف أو الكت ليُضاف بنداً…" />}

        <div>
          <div className="mb-1 grid grid-cols-[minmax(0,1fr)_70px_110px_90px_32px] gap-2 px-1 text-xs font-medium text-muted">
            <span>الصنف أو الكت</span><span>الكمية</span><span>سعر الوحدة</span><span>المجموع</span><span />
          </div>
          <div className="flex flex-col gap-2">
            {items.map((it, i) => {
              const kit = kitOf(it.name);
              return (
                <div key={i}>
                  <div className="grid grid-cols-[minmax(0,1fr)_70px_110px_90px_32px] items-center gap-2">
                    <div className="relative">
                      <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="الصنف" list="stock-names" aria-label="الصنف" className={`${inp} pe-16`} autoFocus={i === 0} />
                      {it.name.trim() && (kit ? (
                        <span data-testid="line-kit" title={`كت — يُضاف: ${kitText(kit)}`} className="pointer-events-none absolute end-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"><Package className="size-3" /> كت</span>
                      ) : inStock(it.name) ? (
                        <span title="صنف في المخزن — تُضاف الكمية إليه" className="pointer-events-none absolute end-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"><Boxes className="size-3" /> مخزن</span>
                      ) : (
                        <span title="صنف جديد — يُضاف إلى المخزن عند الحفظ" className="pointer-events-none absolute end-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700"><Plus className="size-3" /> جديد</span>
                      ))}
                    </div>
                    <NumberInput value={it.qty} onValue={(v) => setItem(i, { qty: Number(v) || 0 })} aria-label="الكمية" className={inp} />
                    <NumberInput value={it.unitPrice} onValue={(v) => setItem(i, { unitPrice: Number(v) || 0 })} group zeroEmpty placeholder="0" aria-label="سعر الوحدة" className={inp}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (i === items.length - 1) addLine(); } }} />
                    <span className="text-sm tabular-nums text-muted">{money(Number(it.qty || 0) * Number(it.unitPrice || 0))}</span>
                    <button type="button" onClick={() => setItems((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : [emptyLine()]))} aria-label="حذف البند"
                      className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button>
                  </div>
                  {kit && <div className="mt-0.5 px-1 text-[11px] text-violet-700" data-testid="kit-contents">يُضاف إلى المخزن: {kitText(kit, Number(it.qty) || 0)}</div>}
                </div>
              );
            })}
          </div>
          <datalist id="stock-names">
            {kits.map((k) => <option key={k.id} value={k.name}>كت: {kitText(k)}</option>)}
            {stock.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
          <button type="button" onClick={addLine} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline"><Plus className="size-4" /> بند آخر</button>
          <span className="ms-2 text-[11px] text-muted">(أو Enter في خانة السعر)</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-canvas px-4 py-3">
          <div className="text-base">الإجمالي: <b className="text-xl tabular-nums text-amber-700" data-testid="purchase-total">{money(total)}</b> د.ع</div>
          {opts.debts ? (
            <label className="ms-auto flex items-center gap-2 text-sm font-medium">المدفوع الآن
              <NumberInput value={paidAmount} onValue={(v) => setPaidAmount(Number(v) || 0)} group zeroEmpty placeholder="0" aria-label="المدفوع الآن" className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
            </label>
          ) : (
            <label className="ms-auto inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={paid} onChange={(e) => setPaidNow(e.target.checked)} className="size-5 accent-teal-600" aria-label="مدفوعة" /> مدفوعة
            </label>
          )}
        </div>

        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" aria-label="ملاحظات" className={inp} />
        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={toStock} onChange={(e) => setToStock(e.target.checked)} aria-label="إضافة الكميات إلى المخزن" /> إضافة البنود إلى المخزن عند الحفظ
        </label>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={save} className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-base font-semibold text-white hover:bg-amber-700">حفظ العملية</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-3 text-sm hover:bg-canvas">إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}
