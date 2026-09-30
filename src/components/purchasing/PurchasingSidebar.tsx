"use client";

import { ShoppingCart, Truck, Settings, FileBarChart, Boxes, Tags, ClipboardCheck, History } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { getStock, daysToExpiry, pendingStock } from "@/lib/station/store";
import { pendingQcStock } from "@/lib/local/links";

const SECTIONS: SideSection[] = [
  { title: "العمل اليومي", items: [
    { href: "/store", label: "المشتريات", hint: "عمليات الشراء والدفع", icon: ShoppingCart, exact: true },
    { href: "/store/inventory", label: "المخزن", hint: "الموجود الآن والصرف", icon: Boxes },
    { href: "/store/items", label: "الأصناف", hint: "الكواشف والمستلزمات والكتات", icon: Tags },
  ] },
  { title: "المتابعة", items: [
    { href: "/store/count", label: "الجرد", hint: "المعدود مقابل المسجّل", icon: ClipboardCheck },
    { href: "/store/moves", label: "سجل الحركة", hint: "كل تغيّر في الكميات", icon: History },
    { href: "/store/suppliers", label: "الموردون", hint: "الأسماء والهواتف", icon: Truck },
    { href: "/store/report", label: "التقارير (شهري/سنوي)", hint: "المصروف حسب الفترة", icon: FileBarChart },
  ] },
  { title: "الإدارة", items: [
    { href: "/store/settings", label: "الإعدادات والنسخ الاحتياطي", hint: "الترويسة والخيارات والنسخ", icon: Settings },
  ] },
];

function badges(): SideBadges {
  const pending = pendingStock().length + pendingQcStock().length;
  const alerts = getStock().filter((s) => {
    const d = daysToExpiry(s.expiry);
    return (s.minQty != null && Number(s.qty) <= Number(s.minQty)) || (d != null && d <= 30);
  }).length;
  return {
    "/store/inventory": [
      { n: pending, tone: "info", testid: "stock-pending-count", title: "بانتظار الصرف" },
      { n: alerts, tone: "warn", testid: "stock-alerts", title: "نفد أو ناقص أو قرب الانتهاء" },
    ],
  };
}

export function PurchasingSidebar() {
  return <AppSidebar appName="المخزن والمشتريات" appTag="نسخة محلية — بدون إنترنت" icon={ShoppingCart} sections={SECTIONS} getBadges={badges}
    footerNote="المخزن مشترك مع محطة المختبر والجودة على هذا الجهاز: يُضاف إليه ما يُشترى ويُحسم منه ما يُستعمل." />;
}
