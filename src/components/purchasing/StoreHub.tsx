"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, Boxes } from "lucide-react";
import { getStock, daysToExpiry } from "@/lib/station/store";
import { getPurchases } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";
import { PurchasesPanel } from "./PurchasesPanel";
import { StockPanel } from "./StockPanel";

/** «المشتريات والمخزن»: one screen for buying and for the stock room it fills (two tabs). */
export function StoreHub({ tab }: { tab: "purchases" | "stock" }) {
  const [sum, setSum] = useState({ items: 0, alerts: 0, spent: 0, unpaid: 0 });
  useEffect(() => {
    const stock = getStock(), purchases = getPurchases();
    setSum({
      items: stock.length,
      alerts: stock.filter((s) => { const d = daysToExpiry(s.expiry); return (s.minQty != null && Number(s.qty) <= Number(s.minQty)) || (d != null && d <= 30); }).length,
      spent: purchases.reduce((t, p) => t + Number(p.total || 0), 0),
      unpaid: purchases.filter((p) => !p.paid).reduce((t, p) => t + Number(p.total || 0), 0),
    });
  }, [tab]);
  const tabCls = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm ${on ? "bg-amber-600 font-semibold text-white" : "hover:bg-canvas"}`;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="size-6" /> المشتريات والمخزن</h1>
          <p className="mt-1 text-xs text-muted" data-testid="store-summary">
            المصروف <b className="tabular-nums">{money(sum.spent)}</b> د.ع · غير مدفوع <b className="tabular-nums">{money(sum.unpaid)}</b> د.ع ·
            أصناف المخزن <b className="tabular-nums">{sum.items}</b>{sum.alerts > 0 && <> · <b className="tabular-nums text-amber-700">{sum.alerts}</b> تنبيه</>}
          </p>
        </div>
        <nav data-testid="store-tabs" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          <Link href="/store" className={tabCls(tab === "purchases")} aria-current={tab === "purchases" ? "page" : undefined}><ShoppingCart className="size-4" /> المشتريات</Link>
          <Link href="/store/inventory" className={tabCls(tab === "stock")} aria-current={tab === "stock" ? "page" : undefined}>
            <Boxes className="size-4" /> المخزن
            {sum.alerts > 0 && <span className="rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-amber-700 tabular-nums">{sum.alerts}</span>}
          </Link>
        </nav>
      </div>
      {tab === "purchases" ? <PurchasesPanel /> : <StockPanel />}
    </div>
  );
}
