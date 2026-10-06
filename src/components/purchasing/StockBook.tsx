"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Plus, Truck } from "lucide-react";
import { getStock, daysToExpiry, type StockItem } from "@/lib/station/store";
import { getKits, getPurchases, getSettings, dueOf, type Kit, type Purchase, type PurchasingSettings } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";
import { PurchaseForm } from "./PurchaseForm";
import { PurchasesLog } from "./PurchasesLog";
import { StockPanel } from "./StockPanel";

function Tile({ label, value, tone, testid }: { label: string; value: string | number; tone?: "danger" | "warn"; testid?: string }) {
  const c = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-amber-700";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid={testid}>
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

/**
 * «المشتريات والمخزن والأسعار» — one page for the lab's purchases, stock room and prices, laid out as
 * in the supplier station (at /store, opening on the purchases log, and /store/inventory, opening on
 * the stock): the figures, one entry «إدخال مخزني» (bought from a supplier, or an opening balance /
 * adjustment), then the stock with its prices or the purchases log. The stock room is shared with the
 * lab and quality stations; an ordered purchase counts as spending, and enters the stock, once received.
 */
export function StockBook({ view: view0 = "purchases" }: { view?: "purchases" | "stock" }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [msg, setMsg] = useState("");
  const [view, setView] = useState(view0);
  // The stock list keeps its own state: it is drawn afresh after each entry.
  const [stamp, setStamp] = useState(0);
  const reload = () => { setStamp((n) => n + 1); setPurchases(getPurchases()); setStock(getStock()); setKits(getKits()); setOpts(getSettings()); };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's data (browser storage) is read once the page is on screen, never while rendering on the server
    reload();
  }, []);

  const arrived = purchases.filter((p) => !p.ordered);
  const spent = arrived.reduce((s, p) => s + Number(p.total || 0), 0);
  const unpaid = arrived.reduce((s, p) => s + (opts.debts ? dueOf(p) : p.paid ? 0 : Number(p.total) || 0), 0);
  const low = stock.filter((s) => Number(s.qty) <= 0 || (s.minQty != null && Number(s.qty) <= Number(s.minQty))).length;
  const soon = stock.filter((s) => { const d = daysToExpiry(s.expiry); return d != null && d <= 30; }).length;
  const value = stock.reduce((t, s) => t + (s.price != null ? Math.max(0, Number(s.qty) || 0) * s.price : 0), 0);
  const orderedN = purchases.length - arrived.length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Boxes className="size-6" /> المشتريات والمخزن والأسعار</h1>
          <p className="mt-1 text-sm text-muted">صفحة واحدة للشراء من الموردين ولمواد المختبر وأسعارها ومخزنها: ما يُشترى يدخل المخزن بكلفته، وما تستعمله محطة المختبر والجودة يُحسم منه.</p>
        </div>
        <Link href="/store/suppliers" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Truck className="size-4" /> الموردون</Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="store-summary">
        <Tile label="أصناف المخزن" value={stock.length} />
        <Tile label="نفد أو عند الحد الأدنى" value={low} tone={low ? "danger" : undefined} />
        <Tile label="تنتهي خلال 30 يوماً" value={soon} tone={soon ? "warn" : undefined} />
        <Tile label="قيمة المخزن (بالكلفة)" value={money(value)} testid="store-value" />
        <Tile label="المشتريات (المصروف)" value={money(spent)} testid="purchase-totals" />
        <Tile label="غير مدفوع للموردين" value={money(unpaid)} tone={unpaid > 0 ? "danger" : undefined} />
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="item-entry">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Plus className="size-4 text-amber-700" /> إدخال مخزني</div>
        <PurchaseForm onSaved={(m) => { setMsg(m); reload(); }} />
      </div>

      {msg && <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}
      <div className="mb-3 flex gap-1 border-b border-line text-sm" role="tablist" aria-label="العرض">
        {([["stock", `المخزن والأسعار (${stock.length})`], ["purchases", `سجل المشتريات (${purchases.length})${orderedN ? ` · ${orderedN} بانتظار الاستلام` : ""}`]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} data-testid={`view-${k}`} onClick={() => setView(k)}
            className={`-mb-px border-b-2 px-4 py-2 ${view === k ? "border-amber-600 font-semibold text-amber-700" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {view === "purchases"
        ? <PurchasesLog purchases={purchases} stock={stock} kits={kits} opts={opts} onChanged={reload} onMsg={setMsg} />
        : <StockPanel key={stamp} />}
    </div>
  );
}
