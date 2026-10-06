"use client";

import { ShoppingCart, Boxes, Tags, History, ClipboardCheck, ShoppingBasket } from "lucide-react";
import { StockBook } from "./StockBook";
import { ItemsPanel } from "./ItemsPanel";
import { MovesPanel } from "./MovesPanel";
import { CountPanel } from "./CountPanel";
import { ReorderPanel } from "./ReorderPanel";

const TITLES = {
  purchases: { title: "المشتريات", icon: ShoppingCart, desc: "" },
  stock: { title: "المخزن", icon: Boxes, desc: "" },
  items: { title: "الأصناف", icon: Tags, desc: "الكواشف والمستلزمات والكتات، والتحاليل وموادها: ما يُحسم من المخزن مع كل فحص، وما يصرفه الفاحص بيده." },
  moves: { title: "سجل الحركة", icon: History, desc: "كل تغيّر في كميات المخزن: المشتريات، نتائج المختبر، السيطرة، الإضافة والصرف، الجرد والتعديل." },
  count: { title: "الجرد", icon: ClipboardCheck, desc: "" },
  reorder: { title: "اقتراح الشراء", icon: ShoppingBasket, desc: "" },
} as const;

/** A page of «المخزن والمشتريات», each laid out as its page in the supplier station: «المشتريات
 *  والمخزن والأسعار» (/store and /store/inventory), «الجرد», «اقتراح الشراء», and the lab's own
 *  «الأصناف» (tests and their materials, tubes, kits) and «سجل الحركة». */
export function StoreHub({ tab }: { tab: keyof typeof TITLES }) {
  if (tab === "purchases" || tab === "stock") return <StockBook view={tab} />;
  if (tab === "count") return <CountPanel />;
  if (tab === "reorder") return <ReorderPanel />;
  return <OtherTabs tab={tab} />;
}

function OtherTabs({ tab }: { tab: "items" | "moves" }) {
  const T = TITLES[tab];
  return (
    <div>
      <div className="no-print mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><T.icon className="size-6" /> {T.title}</h1>
        <p className="mt-1 text-sm text-muted">{T.desc}</p>
      </div>
      {tab === "items" ? <ItemsPanel /> : <MovesPanel />}
    </div>
  );
}
