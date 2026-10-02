"use client";

import { useCallback, useEffect } from "react";
import { MessagesSquare, LayoutDashboard, Users, Globe2, Building2, Link2, FileLock2, Settings } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { unread, contacts, useConnect } from "@/lib/connect/store";
import { startConnect } from "@/lib/connect/net";

const SECTIONS: SideSection[] = [
  { title: "المحادثات", items: [
    { href: "/connect", label: "الرئيسية", hint: "آخر المحادثات والحالة", icon: LayoutDashboard, exact: true },
    { href: "/connect/room", label: "المحادثة الداخلية", hint: "بين حواسيب المختبر", icon: Users },
    { href: "/connect/public", label: "المحادثة العامة", hint: "مع كل المختبرات", icon: Globe2 },
    { href: "/connect/labs", label: "المختبرات", hint: "التواصل المشفّر مع مختبر", icon: Building2 },
  ] },
  { title: "طرق الإرسال", items: [
    { href: "/connect/direct", label: "اتصال مباشر", hint: "حاسوب لحاسوب برمز ربط", icon: Link2 },
    { href: "/connect/file", label: "رسالة بملف", hint: "ملف مشفّر لمختبر آخر", icon: FileLock2 },
  ] },
  { title: "الإدارة", items: [
    { href: "/connect/settings", label: "الإعدادات", hint: "الاسم والرموز والتنبيه", icon: Settings },
  ] },
];

/** «محطة التواصل»'s menu: unread counts beside each conversation; also starts the poller. */
export function ConnectSidebar() {
  const rev = useConnect();
  useEffect(() => { startConnect(); }, []);
  const badges = useCallback((): SideBadges => {
    void rev;
    const labs = contacts().reduce((n, c) => n + unread(`c:${c.id}`), 0);
    return {
      "/connect/room": { n: unread("room"), tone: "danger", testid: "badge-room" },
      "/connect/public": { n: unread("public"), tone: "info", testid: "badge-public" },
      "/connect/labs": { n: labs, tone: "danger", testid: "badge-labs" },
    };
  }, [rev]);
  return <AppSidebar appName="محطة التواصل" appTag="داخلي · مختبرات · عامة" icon={MessagesSquare} sections={SECTIONS} getBadges={badges}
    footerNote="الرسائل محفوظة على هذا الحاسوب فقط، والرسائل للمختبرات مشفّرة لا يفتحها غيرهم." />;
}
