"use client";

import { ShieldCheck, LayoutDashboard, FlaskConical, LineChart, Thermometer, Wrench, SlidersHorizontal, Settings } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { summary } from "@/lib/qc/store";

const SECTIONS: SideSection[] = [
  { title: "اليوم", items: [
    { href: "/qc", label: "لوحة الجودة", hint: "حالة اليوم والتنبيهات", icon: LayoutDashboard, exact: true },
    { href: "/qc/entry", label: "إدخال السيطرة اليومية", hint: "قيم الكنترول لكل مستوى", icon: FlaskConical },
    { href: "/qc/temps", label: "سجل الحرارة", hint: "الثلاجات والحاضنات", icon: Thermometer },
  ] },
  { title: "المتابعة", items: [
    { href: "/qc/chart", label: "مخطط Levey-Jennings", hint: "المخطط وقواعد Westgard", icon: LineChart },
    { href: "/qc/devices", label: "الأجهزة والصيانة", hint: "الصيانة والمعايرة والأعطال", icon: Wrench },
  ] },
  { title: "الإدارة", items: [
    { href: "/qc/analytes", label: "مواد السيطرة", hint: "المستويات والمتوسط وSD", icon: SlidersHorizontal },
    { href: "/qc/settings", label: "الإعدادات", hint: "الترويسة والنسخ", icon: Settings },
  ] },
];

function badges(): SideBadges {
  const s = summary();
  return {
    "/qc/entry": { n: s.levelsTotal - s.levelsDone, tone: "warn" },
    "/qc/chart": { n: s.rejects, tone: "danger" },
    "/qc/temps": { n: s.tempsOut || s.tempsMissing, tone: s.tempsOut ? "danger" : "warn" },
    "/qc/devices": { n: s.tasksDue + s.calibOverdue + s.openFaults, tone: s.calibOverdue || s.openFaults ? "danger" : "warn" },
  };
}

export function QcSidebar() {
  return <AppSidebar appName="محطة الجودة والأجهزة" appTag="QC · Westgard · الصيانة" icon={ShieldCheck} sections={SECTIONS} getBadges={badges}
    footerNote="محطة مستقلة — بياناتها محفوظة على هذا الجهاز فقط ولا ترتبط بأي محطة أخرى." />;
}
