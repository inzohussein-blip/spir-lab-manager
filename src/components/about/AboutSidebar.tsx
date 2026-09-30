"use client";

import {
  Info, Rocket, Beaker, FileText, ShoppingCart, GraduationCap, ShieldCheck, Users, RefreshCw, LayoutDashboard,
  Database, Lightbulb, CircleHelp, Phone, Settings, type LucideIcon,
} from "lucide-react";
import { AppSidebar, type SideSection } from "@/components/local/AppSidebar";
import { aboutHref, aboutPage } from "@/lib/about/content";

const ICONS: Record<string, LucideIcon> = {
  "": Info, start: Rocket, station: Beaker, report: FileText, store: ShoppingCart, training: GraduationCap, qc: ShieldCheck,
  roster: Users, sync: RefreshCw, admin: LayoutDashboard, data: Database, tips: Lightbulb, faq: CircleHelp, support: Phone,
};

const item = (slug: string) => {
  const p = aboutPage(slug)!;
  return { href: aboutHref(slug), label: p.title, hint: p.hint, icon: ICONS[slug], exact: true };
};

const SECTIONS: SideSection[] = [
  { title: "التعريف", items: ["", "start"].map(item) },
  { title: "المحطات", items: ["station", "report", "store", "training", "qc", "roster", "sync", "admin"].map(item) },
  { title: "المساعدة", items: ["data", "tips", "faq", "support"].map(item) },
  { title: "الإدارة", items: [{ href: "/about/settings", label: "الإعدادات", hint: "المظهر وحجم الخط", icon: Settings }] },
];

export function AboutSidebar() {
  return <AppSidebar appName="عن التطبيق" appTag="الشرح والمساعدة" icon={Info} sections={SECTIONS}
    footerNote="شرح ثابت للتطبيق ومحطاته — لا يحتاج تفعيلاً ولا يحفظ بيانات." />;
}
