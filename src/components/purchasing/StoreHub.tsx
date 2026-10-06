"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Boxes, Tags, History, ClipboardCheck } from "lucide-react";
import { getStock, daysToExpiry } from "@/lib/station/store";
import { getPurchases } from "@/lib/purchasing/store";
import { money } from "@/lib/utils";
import { PurchasesPanel } from "./PurchasesPanel";
import { StockPanel } from "./StockPanel";
import { ItemsPanel } from "./ItemsPanel";
import { MovesPanel } from "./MovesPanel";
import { CountPanel } from "./CountPanel";

const TITLES = {
  purchases: { title: "المشتريات", icon: ShoppingCart },
  stock: { title: "المخزن", icon: Boxes },
  items: { title: "الأصناف", icon: Tags },
  moves: { title: "سجل الحركة", icon: History },
  count: { title: "الجرد", icon: ClipboardCheck },
} as const;

/** A page of «المخزن والمشتريات» (each has its own entry in the side menu): «المشتريات», «المخزن»
 *  (what is in stock) and «الأصناف» (the items: the lab's tests and their materials, and tubes). */
export function StoreHub({ tab }: { tab: keyof typeof TITLES }) {
  const [sum, setSum] = useState({ items: 0, alerts: 0, spent: 0, unpaid: 0 });
  useEffect(() => {
    const stock = getStock(), purchases = getPurchases();
    setSum({
      items: stock.length,
      alerts: stock.filter((s) => { const d = daysToExpiry(s.expiry); return (s.minQty != null && Number(s.qty) <= Number(s.minQty)) || (d != null && d <= 30); }).length,
      // An ordered purchase that has not arrived is not spending yet.
      spent: purchases.filter((p) => !p.ordered).reduce((t, p) => t + Number(p.total || 0), 0),
      unpaid: purchases.filter((p) => !p.ordered && !p.paid).reduce((t, p) => t + Number(p.total || 0), 0),
    });
  }, [tab]);
  const T = TITLES[tab];
  return (
    <div>
      <div className="no-print mb-4">
        <div className="text-xs font-semibold text-amber-700">المخزن والمشتريات</div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><T.icon className="size-6" /> {T.title}</h1>
        <p className="mt-1 text-xs text-muted" data-testid="store-summary">
          المصروف <b className="tabular-nums">{money(sum.spent)}</b> د.ع · غير مدفوع <b className="tabular-nums">{money(sum.unpaid)}</b> د.ع ·
          أصناف المخزن <b className="tabular-nums">{sum.items}</b>{sum.alerts > 0 && <> · <b className="tabular-nums text-amber-700">{sum.alerts}</b> تنبيه</>}
        </p>
      </div>
      {tab === "purchases" ? <PurchasesPanel /> : tab === "stock" ? <StockPanel /> : tab === "items" ? <ItemsPanel /> : tab === "moves" ? <MovesPanel /> : <CountPanel />}
    </div>
  );
}
