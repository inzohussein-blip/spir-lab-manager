"use client";

import { RefreshCw, LayoutDashboard, FileDown, Network, History, Settings } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { sameNameRecords } from "@/lib/local/fileSync";

const SECTIONS: SideSection[] = [
  { title: "المزامنة", items: [
    { href: "/sync", label: "نظرة عامة", hint: "هذا الحاسوب وحالة المزامنة", icon: LayoutDashboard, exact: true },
    { href: "/sync/file", label: "المزامنة بملف", hint: "تصدير ملف وإدخال ملف", icon: FileDown },
    { href: "/sync/auto", label: "المزامنة التلقائية", hint: "عبر الإنترنت أو الشبكة المحلية", icon: Network },
    { href: "/sync/log", label: "سجل المزامنة", hint: "ما صُدّر وما أُدخل", icon: History },
  ] },
  { title: "الإدارة", items: [
    { href: "/sync/settings", label: "الإعدادات", hint: "اسم الحاسوب والمحطات المشتركة", icon: Settings },
  ] },
];

function badges(): SideBadges {
  const d = sameNameRecords();
  return { "/sync": { n: d.patients.length + d.stock.length + d.tests.length, tone: "warn" } };
}

export function SyncSidebar() {
  return <AppSidebar appName="محطة المزامنة" appTag="بين حواسيب المختبر" icon={RefreshCw} sections={SECTIONS} getBadges={badges}
    footerNote="تجمع بيانات المحطات (عدا ما تختاره للحاسوب وحده) بين حواسيب المختبر نفسه فقط." />;
}
