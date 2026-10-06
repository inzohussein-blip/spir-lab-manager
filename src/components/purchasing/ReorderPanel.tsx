"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBasket, Send, Printer, X } from "lucide-react";
import { getStock, type StockItem } from "@/lib/station/store";
import { getMoves, type StockMove } from "@/lib/local/links";
import { addPurchase, getPurchases, getSettings, getSuppliers, saveSettings, uid, type PurchasingSettings, type Supplier } from "@/lib/purchasing/store";
import { NumberInput } from "@/components/local/NumberInput";
import { money } from "@/lib/utils";

const DAYS = 90; // the use rate is taken over the last 90 days
const USED = new Set<StockMove["reason"]>(["result", "qc", "issue"]);
const today = () => new Date().toLocaleDateString("en-CA");

interface Row { item: StockItem; min: number; perDay: number; suggested: number; supplierId: string }

/**
 * «اقتراح الشراء», as in the supplier station: the materials at their minimum, or that will not last
 * the days to cover at their rate of use (the lab's results, control runs, issued by hand over the
 * last 90 days), grouped by the supplier they were last bought from. The quantity and supplier can be
 * changed; each group prints as a purchase order, or goes to «المشتريات» as an order waiting to be
 * received («استلام» brings it into the stock room).
 */
export function ReorderPanel() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lastSup, setLastSup] = useState<Map<string, string>>(new Map());
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sup, setSup] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState<{ supplier?: Supplier; rows: (Row & { n: number })[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's data (browser storage) is read once the page is on screen, never while rendering on the server
    setStock(getStock()); setMoves(getMoves()); setSuppliers(getSuppliers()); setOpts(getSettings()); setNow(Date.now());
    // Each material's last supplier: from the purchases, newest first.
    const m = new Map<string, string>();
    const sups = getSuppliers();
    for (const p of [...getPurchases()].sort((a, b) => b.created_at - a.created_at)) {
      const id = p.supplierId ?? sups.find((s) => s.name.trim() === p.supplierName?.trim())?.id;
      if (!id) continue;
      for (const it of p.items) { const k = it.name.trim().toLowerCase(); if (!m.has(k)) m.set(k, id); }
    }
    setLastSup(m);
  }, [tick]);

  const cover = Math.max(1, Math.min(365, Number(opts.reorderCoverDays) || 30));
  const setCover = (n: number) => { const next = { ...getSettings(), reorderCoverDays: Math.max(1, Math.min(365, Math.round(n) || 30)) }; saveSettings(next); setOpts(next); };

  const rows = useMemo<Row[]>(() => {
    const since = now - DAYS * 86_400_000;
    const used = new Map<string, number>();
    for (const m of moves) if (m.at >= since && USED.has(m.reason) && m.delta < 0) used.set(m.stockId, (used.get(m.stockId) ?? 0) - m.delta);
    return stock.flatMap((item) => {
      const have = Number(item.qty) || 0, min = Number(item.minQty) || 0;
      const perDay = (used.get(item.id) ?? 0) / DAYS;
      const need = Math.ceil(perDay * cover);
      if (!(have <= min && item.minQty != null) && !(perDay > 0 && have < need)) return [];
      const suggested = Math.max(1, Math.max(need, min * 2) - Math.max(0, have));
      return [{ item, min, perDay, suggested, supplierId: lastSup.get(item.name.trim().toLowerCase()) ?? "" }];
    });
  }, [stock, moves, cover, lastSup, now]);

  const supOf = (r: Row) => sup[r.item.id] ?? r.supplierId;
  const qtyOf = (r: Row) => Math.max(0, Math.round(qty[r.item.id] ?? r.suggested));
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const k = supOf(r); groups.set(k, [...(groups.get(k) ?? []), r]); }
  const supName = (id: string) => suppliers.find((x) => x.id === id)?.name ?? "";

  function send(id: string, list: Row[]) {
    const items = list.filter((r) => qtyOf(r) > 0).map((r) => {
      const unit = r.item.price ?? 0, n = qtyOf(r);
      return { ...(r.item.device ? { device: r.item.device } : {}), name: r.item.name, qty: n, unitPrice: unit, total: Math.round(unit * n * 100) / 100 };
    });
    if (!items.length) return;
    const ok = addPurchase({ id: uid(), created_at: Date.now(), date: today(), supplierId: id || undefined, supplierName: supName(id) || undefined, items,
      total: items.reduce((t, it) => t + it.total, 0), paid: false, ordered: true, notes: "من اقتراح الشراء" });
    setMsg(ok ? `أُرسل الطلب إلى «المشتريات» (${items.length} مادة) — اضغط «استلام» هناك عند وصوله ليدخل المخزن.` : "تعذّر الحفظ: مساحة التخزين في المتصفح ممتلئة.");
    setTick((n) => n + 1);
  }

  return (
    <div>
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>
      <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingBasket className="size-6" /> اقتراح الشراء</h1>
          <p className="mt-1 text-sm text-muted">المواد التي وصلت حدّها الأدنى أو لا تكفي صرف {cover} يوماً (حسب معدّل آخر {DAYS} يوماً). عدّل الكمية والمورّد، ثم اطبع طلب الشراء أو أرسله إلى «المشتريات».</p>
        </div>
        <label className="flex items-center gap-2 text-sm">يكفي لـ
          <NumberInput value={cover} onValue={(v) => setCover(Number(v))} aria-label="أيام التغطية" className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm tabular-nums" />
          يوماً
        </label>
      </div>
      {msg && <p className="no-print mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}
      {rows.length === 0 ? (
        <p className="no-print rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted" data-testid="reorder-empty">لا مواد تحتاج إلى طلب الآن.</p>
      ) : (
        <div className="no-print flex flex-col gap-4">
          {[...groups].map(([id, list]) => (
            <div key={id || "none"} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="reorder-group">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <b>{id ? supName(id) || "مورّد" : "بدون مورّد محدّد"}</b>
                <span className="text-xs text-muted">{list.length} مادة · {money(list.reduce((a, r) => a + qtyOf(r) * (r.item.price ?? 0), 0))} د.ع تقريباً</span>
                <div className="ms-auto flex gap-2">
                  <button onClick={() => setDoc({ supplier: suppliers.find((x) => x.id === id), rows: list.map((r) => ({ ...r, n: qtyOf(r) })) })} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas"><Printer className="size-4" /> طلب شراء</button>
                  <button onClick={() => send(id, list)} data-testid="reorder-send" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"><Send className="size-4" /> إرسال إلى المشتريات</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-right text-xs text-muted"><tr className="border-b border-line"><th className="py-2 font-medium">المادة</th><th className="py-2 font-medium">الرصيد / الحد</th><th className="py-2 font-medium">الصرف اليومي</th><th className="py-2 font-medium">الكمية المقترحة</th><th className="py-2 font-medium">المورّد</th></tr></thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.item.id} data-item={r.item.name} className="border-b border-line last:border-0">
                        <td className="py-2 pe-3"><div className="font-medium">{r.item.name}</div><div className="text-[11px] text-muted">{r.item.device || "بدون جهاز"}</div></td>
                        <td className={`py-2 pe-3 tabular-nums ${Number(r.item.qty) <= r.min ? "font-semibold text-red-600" : ""}`}>{r.item.qty} / {r.item.minQty ?? "—"}</td>
                        <td className="py-2 pe-3 tabular-nums text-muted">{r.perDay.toFixed(1)}</td>
                        <td className="py-2 pe-3"><NumberInput value={qtyOf(r)} onValue={(v) => setQty({ ...qty, [r.item.id]: Number(v) || 0 })} aria-label={`كمية ${r.item.name}`} className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm tabular-nums" /></td>
                        <td className="py-2">
                          <select value={supOf(r)} onChange={(e) => setSup({ ...sup, [r.item.id]: e.target.value })} aria-label={`مورّد ${r.item.name}`} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                            <option value="">—</option>
                            {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {!suppliers.length && <p className="text-xs text-muted">أضف الموردين من <Link href="/store/suppliers" className="underline">الموردون</Link> لتجميع الطلبات حسب المورّد.</p>}
        </div>
      )}

      {doc && (
        <div className="mt-6">
          <div className="no-print mb-3 flex justify-end gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"><Printer className="size-4" /> طباعة</button>
            <button onClick={() => setDoc(null)} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg border border-line"><X className="size-4" /></button>
          </div>
          <div id="report-sheet" className="mx-auto max-w-[210mm] bg-white p-8 text-black shadow-sm print:p-0 print:shadow-none" data-testid="reorder-doc">
            <div className="flex items-center justify-between border-b-2 border-amber-600 pb-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opts.logo || "/lab-logo.png"} alt="" className="size-14 object-contain" />
                <div>
                  <h2 className="text-xl font-bold text-amber-700">{opts.orgName || "المخزن والمشتريات"}</h2>
                  {opts.subtitle && <p className="text-xs text-gray-600">{opts.subtitle}</p>}
                  <p className="text-sm text-gray-600">طلب شراء</p>
                </div>
              </div>
              <div className="text-left text-xs text-gray-600">
                <div>التاريخ: {today()}</div>
                <div>إلى المورّد: {doc.supplier?.name || "—"}</div>
                {doc.supplier?.phone && <div dir="ltr">{doc.supplier.phone}</div>}
              </div>
            </div>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead><tr className="border-b border-gray-300 text-right text-xs text-gray-500"><th className="w-8 py-1.5">#</th><th className="py-1.5">المادة</th><th className="py-1.5">الجهاز</th><th className="py-1.5 text-center">الكمية المطلوبة</th></tr></thead>
              <tbody>
                {doc.rows.filter((r) => r.n > 0).map((r, i) => (
                  <tr key={r.item.id} className="border-b border-gray-100"><td className="py-1.5 tabular-nums">{i + 1}</td><td className="py-1.5">{r.item.name}</td><td className="py-1.5">{r.item.device ?? ""}</td><td className="py-1.5 text-center tabular-nums">{r.n}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-gray-600"><div>المختبر<div className="h-12 border-b border-gray-400" /></div><div>المورّد<div className="h-12 border-b border-gray-400" /></div></div>
            {opts.footer && <div className="mt-6 rounded-md bg-amber-600 px-3 py-1.5 text-center text-[10px] text-white" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{opts.footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
