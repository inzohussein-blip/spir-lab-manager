"use client";

import { Fragment, useMemo, useState } from "react";
import { Trash2, Search, ChevronDown, Wallet, CheckCircle2, X } from "lucide-react";
import {
  addPayment, deletePurchases, dueOf, lineTotal, paidOf, receivePurchase, setPaid,
  type Kit, type Purchase, type PurchaseItem, type PurchasingSettings,
} from "@/lib/purchasing/store";
import type { StockItem } from "@/lib/station/store";
import { NumberInput } from "@/components/local/NumberInput";
import { money } from "@/lib/utils";
import { Chips } from "./stockParts";

type Status = "all" | "unpaid" | "paid" | "ordered";

/**
 * The purchases log (newest first): search, a payment filter, select and delete (what a purchase
 * brought into the stock room leaves it), open a purchase to see its lines (and the price of one),
 * mark it paid — or, with supplier debts on, record a payment — and receive an ordered purchase.
 * The parent reloads its data after each change.
 */
export function PurchasesLog({ purchases, stock, kits, opts, onChanged, onMsg }: {
  purchases: Purchase[]; stock: StockItem[]; kits: Kit[]; opts: PurchasingSettings; onChanged: () => void; onMsg: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const isPaid = (p: Purchase) => (opts.debts ? dueOf(p) <= 0 : p.paid);
  const sorted = useMemo(() => [...purchases].sort((a, b) => (a.date === b.date ? b.created_at - a.created_at : a.date < b.date ? 1 : -1)), [purchases]);
  const term = q.trim().toLowerCase();
  const orderedN = purchases.filter((p) => p.ordered).length;
  const unpaidN = purchases.filter((p) => !p.ordered && !isPaid(p)).length;
  const shown = sorted.filter((p) => (status === "all" || (status === "ordered" ? !!p.ordered : !p.ordered && (status === "paid") === isPaid(p)))
    && (!term || (p.supplierName ?? "").toLowerCase().includes(term) || (p.supplierRef ?? "").toLowerCase().includes(term) || p.items.some((it) => it.name.toLowerCase().includes(term))));

  /** Under a line's total: the price of one — for a kit of one item, of one unit it holds. */
  function oneOf(it: PurchaseItem): string {
    const kit = it.kitId ? kits.find((k) => k.id === it.kitId) : undefined;
    const part = kit?.parts.length === 1 ? kit.parts[0] : undefined;
    const n = part ? part.qty * (Number(it.qty) || 0) : 0;
    if (part && n > 0) return `الواحد (${stock.find((x) => x.id === part.stockId)?.name ?? "؟"}) ${money(Math.round((lineTotal(it) / n) * 100) / 100)}`;
    return `${kit ? "الكت الواحد" : "الواحد"} ${money(it.unitPrice)}`;
  }
  function remove(ids: string[]) {
    if (ids.length === 0) return;
    const stocked = purchases.some((p) => ids.includes(p.id) && p.stockAdded?.length);
    if (!window.confirm(`${ids.length === 1 ? "حذف هذه العملية؟" : `حذف ${ids.length} عملية؟`}${stocked ? "\nما أدخلته إلى المخزن يخرج منه." : ""}`)) return;
    deletePurchases(ids);
    setChecked((c) => { const n = new Set(c); ids.forEach((id) => n.delete(id)); return n; });
    onChanged();
  }
  function markPaid(p: Purchase, paid: boolean) {
    if (!paid && !window.confirm("إرجاع هذه العملية إلى «غير مدفوعة»؟")) return;
    setPaid(p.id, paid); onChanged();
    onMsg(paid ? `سُجّلت مدفوعة: ${p.supplierName ?? "عملية"} ${p.date}` : "أُعيدت إلى غير مدفوعة.");
  }
  /** Supplier debts: the amount typed, or (left empty) everything still owed. */
  function pay(p: Purchase) {
    const amount = payAmount > 0 ? Math.min(payAmount, dueOf(p)) : dueOf(p);
    if (!(amount > 0)) return;
    addPayment(p.id, amount); onChanged(); setPayFor(null); setPayAmount(0);
  }
  function receive(p: Purchase) {
    const n = receivePurchase(p.id); onChanged();
    onMsg(n ? `استُلمت الطلبية وأُضيفت ${n} مادة إلى المخزن.` : "استُلمت الطلبية.");
  }
  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allChecked = shown.length > 0 && shown.every((p) => checked.has(p.id));
  const toggleAll = () => setChecked((c) => { const n = new Set(c); if (allChecked) shown.forEach((p) => n.delete(p.id)); else shown.forEach((p) => n.add(p.id)); return n; });

  return (
    <div data-testid="purchases-log">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالمورّد أو الفاتورة أو الصنف…" aria-label="بحث في المشتريات" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        <Chips label="الدفع" value={status} onChange={setStatus}
          options={[["all", "الكل", purchases.length], ["unpaid", "غير مدفوعة", unpaidN], ["paid", "مدفوعة", purchases.length - orderedN - unpaidN], ...(orderedN ? [["ordered", "بانتظار الاستلام", orderedN] as [Status, string, number]] : [])]} />
        {checked.size > 0 && (
          <button onClick={() => remove(Array.from(checked))} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            <Trash2 className="size-4" /> حذف المحدَّد ({checked.size})
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm" data-testid="purchases">
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
            {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">{purchases.length === 0 ? "لا عمليات شراء بعد — اكتب أول عملية في الأعلى." : "لا عمليات مطابقة."}</td></tr>}
            {shown.map((p) => {
              const paid = isPaid(p);
              const lines = p.items.map((it) => `${it.device ? `${it.device} — ` : ""}${it.name}${it.kitId ? " (كت)" : ""} × ${it.qty}${it.lot ? ` (${it.lot}${it.expiry ? ` · ${it.expiry}` : ""})` : it.expiry ? ` (${it.expiry})` : ""}`);
              return (
                <Fragment key={p.id}>
                  <tr data-purchase={p.id} className={`border-b border-line last:border-0 hover:bg-canvas ${checked.has(p.id) ? "bg-amber-50" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} className="size-4 align-middle" aria-label={`تحديد عملية ${p.date}`} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{p.date}</td>
                    <td className="px-4 py-3 font-medium">{p.supplierName ?? "بدون مورّد"}{p.supplierRef && <div className="text-[11px] font-normal text-muted" dir="ltr">فاتورة {p.supplierRef}</div>}</td>
                    <td className="px-4 py-3 text-muted">
                      <button onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex items-start gap-1.5 text-start">
                        <ChevronDown className={`mt-0.5 size-4 shrink-0 transition-transform ${open === p.id ? "rotate-180" : ""}`} />
                        <span>{lines.slice(0, 3).join("، ")}{lines.length > 3 ? ` +${lines.length - 3}` : ""}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{money(p.total)} د.ع</td>
                    <td className="px-4 py-3" data-testid="purchase-due">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.ordered ? (
                          <>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">بانتظار الاستلام</span>
                            <button onClick={() => receive(p)} data-testid="purchase-receive" className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">استلام</button>
                          </>
                        ) : paid ? (
                          <button onClick={() => markPaid(p, false)} title="اضغط لإرجاعها إلى غير مدفوعة" className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-brand-dark hover:bg-teal-100">
                            <CheckCircle2 className="size-3.5" /> مدفوعة
                          </button>
                        ) : (
                          <>
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">{opts.debts && paidOf(p) > 0 ? `متبقٍ ${money(dueOf(p))}` : "غير مدفوعة"}</span>
                            <button onClick={() => markPaid(p, true)} aria-label={`تم الدفع ${p.date}`} className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700">تم الدفع</button>
                            {opts.debts && <button onClick={() => { setPayFor(p.id); setPayAmount(0); setOpen(p.id); }} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"><Wallet className="size-3.5" /> دفعة</button>}
                          </>
                        )}
                        {!p.ordered && p.stockAdded?.length ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">دخلت المخزن</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => remove([p.id])} aria-label="حذف العملية" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                  {open === p.id && (
                    <tr className="border-b border-line bg-canvas/60">
                      <td colSpan={7} className="px-4 py-3 text-sm" data-testid="purchase-details">
                        <table className="w-full max-w-2xl">
                          <thead className="text-right text-xs text-muted"><tr><th className="py-1 font-medium">البند</th><th className="font-medium">العدد</th><th className="font-medium">الاكسباير / اللوت</th><th className="font-medium">السعر</th></tr></thead>
                          <tbody>
                            {p.items.map((it, i) => (
                              <tr key={i} className="border-t border-line/60 align-top">
                                <td className="py-1.5">{it.device && <span className="text-muted">{it.device} — </span>}{it.name}{it.kitId && <span className="ms-1 rounded-full bg-violet-50 px-1.5 text-[10px] text-violet-700">كت</span>}</td>
                                <td className="py-1.5 tabular-nums">{it.qty}</td>
                                <td className="py-1.5 text-xs" data-testid="line-batch"><span dir="ltr">{[it.expiry, it.lot && `LOT ${it.lot}`].filter(Boolean).join(" · ") || "—"}</span></td>
                                <td className="py-1.5 tabular-nums" data-testid="line-price">
                                  <div className="font-semibold">{money(lineTotal(it))}</div>
                                  <div className="text-[11px] text-muted">{oneOf(it)}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {p.notes && <p className="mt-2 text-xs text-muted">ملاحظات: {p.notes}</p>}
                        {opts.debts && (p.payments?.length ?? 0) > 0 && (
                          <p className="mt-2 text-xs text-muted">الدفعات: {p.payments!.map((x) => `${money(x.amount)} (${x.date})`).join("، ")} — المدفوع {money(paidOf(p))}، المتبقي {money(dueOf(p))}</p>
                        )}
                        {opts.debts && payFor === p.id && !paid && !p.ordered && (
                          <div className="mt-2 flex items-center gap-2">
                            <NumberInput value={payAmount} onValue={(v) => setPayAmount(Number(v) || 0)} group zeroEmpty placeholder={money(dueOf(p))} aria-label="مبلغ الدفعة" className="w-36 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
                            <button onClick={() => pay(p)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">تسجيل الدفعة</button>
                            <button onClick={() => setPayFor(null)} aria-label="إلغاء" className="text-muted"><X className="size-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
