"use client";

import { ShoppingCart, Truck, Settings, FileBarChart, Tags, ClipboardCheck, History } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { getStock, daysToExpiry, pendingStock } from "@/lib/station/store";
import { pendingQcStock } from "@/lib/local/links";

const SECTIONS: SideSection[] = [
  { title: "العمل اليومي", items: [
    { href: "/store", label: "المشتريات والمخزن والأسعار", hint: "الشراء، المواد وأسعارها، الكميات والصرف", icon: ShoppingCart, exact: true, also: ["/store/inventory"] },
    { href: "/store/suppliers", label: "الموردون", hint: "الأسماء والهواتف", icon: Truck },
  ] },
  { title: "المخزن", items: [
    { href: "/store/items", label: "الأصناف", hint: "الكواشف والمستلزمات والكتات", icon: Tags },
    { href: "/store/count", label: "الجرد", hint: "المعدود مقابل المسجّل", icon: ClipboardCheck },
    { href: "/store/moves", label: "سجل الحركة", hint: "كل تغيّر في الكميات", icon: History },
  ] },
  { title: "المتابعة", items: [
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
    "/store": [
      { n: pending, tone: "info", testid: "stock-pending-count", title: "بانتظار الصرف" },
      { n: alerts, tone: "warn", testid: "stock-alerts", title: "نفد أو ناقص أو قرب الانتهاء" },
    ],
  };
}

export function PurchasingSidebar() {
  return <AppSidebar appName="المخزن والمشتريات" appTag="الموردون · المخزن · الجرد" icon={ShoppingCart} sections={SECTIONS} getBadges={badges}
    footerNote="المخزن مشترك مع محطة المختبر والجودة على هذا الجهاز: يُضاف إليه ما يُشترى ويُحسم منه ما يُستعمل." />;
}
