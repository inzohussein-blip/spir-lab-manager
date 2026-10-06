"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Plus, Truck } from "lucide-react";
import { getStock, daysToExpiry, type StockItem } from "@/lib/station/store";
import { getKits, getPurchases, getSettings, dueOf, type Kit, type Purchase, type PurchasingSettings } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";
import { PurchaseForm } from "./PurchaseForm";
import { PurchasesLog } from "./PurchasesLog";

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
 * «المشتريات» — the page of the purchasing side of «المخزن والمشتريات», laid out as in the supplier
 * station: the title, the figures, the new purchase typed right on the page (a table of lines), and
 * below it the log of purchases. What is bought enters the lab's stock room (shared with the lab and
 * quality stations); an ordered purchase counts as spending, and enters the stock, once received.
 */
export function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [opts, setOpts] = useState<PurchasingSettings>({ orgName: "" });
  const [msg, setMsg] = useState("");
  const reload = () => { setPurchases(getPurchases()); setStock(getStock()); setKits(getKits()); setOpts(getSettings()); };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's data (browser storage) is read once the page is on screen, never while rendering on the server
    reload();
  }, []);

  const arrived = purchases.filter((p) => !p.ordered);
  const spent = arrived.reduce((s, p) => s + Number(p.total || 0), 0);
  const unpaid = arrived.reduce((s, p) => s + (opts.debts ? dueOf(p) : p.paid ? 0 : Number(p.total) || 0), 0);
  const alerts = stock.filter((s) => { const d = daysToExpiry(s.expiry); return (s.minQty != null && Number(s.qty) <= Number(s.minQty)) || (d != null && d <= 30); }).length;
  const orderedN = purchases.length - arrived.length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-amber-700">المخزن والمشتريات</div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="size-6" /> المشتريات</h1>
          <p className="mt-1 text-sm text-muted">اشترِ من المورّدين في صفحة واحدة: ما يُشترى يدخل مخزن المختبر، وما تستعمله محطة المختبر والجودة يُحسم منه.</p>
        </div>
        <Link href="/store/suppliers" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Truck className="size-4" /> الموردون</Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="store-summary">
        <Tile label="أصناف المخزن" value={stock.length} />
        <Tile label="نفد أو ناقص أو قرب الانتهاء" value={alerts} tone={alerts ? "warn" : undefined} />
        <Tile label="المشتريات (المصروف)" value={money(spent)} testid="purchase-totals" />
        <Tile label="غير مدفوع للموردين" value={money(unpaid)} tone={unpaid > 0 ? "danger" : undefined} />
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="item-entry">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Plus className="size-4 text-amber-700" /> عملية شراء جديدة</div>
        <PurchaseForm onSaved={(m) => { setMsg(m); reload(); }} />
      </div>

      {msg && <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-brand-dark" role="status">{msg}</p>}
      <div className="mb-3 flex gap-1 border-b border-line text-sm" role="tablist" aria-label="العرض">
        <button type="button" role="tab" aria-selected data-testid="view-purchases" className="-mb-px border-b-2 border-amber-600 px-4 py-2 font-semibold text-amber-700">
          سجل المشتريات ({purchases.length}){orderedN ? ` · ${orderedN} بانتظار الاستلام` : ""}
        </button>
      </div>
      <PurchasesLog purchases={purchases} stock={stock} kits={kits} opts={opts} onChanged={reload} onMsg={setMsg} />
    </div>
  );
}
