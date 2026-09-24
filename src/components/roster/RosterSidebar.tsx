"use client";

import { Users, LayoutDashboard, CalendarDays, Clock, Plane, Wallet, UserCog, Settings } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { getStaff, getSchedule, getShifts, getAttendance, getLeaves, getSettings, dayStatus } from "@/lib/roster/store";
import { todayYmd } from "@/lib/local/util";

const SECTIONS: SideSection[] = [
  { title: "اليوم", items: [
    { href: "/roster", label: "لوحة الدوام", hint: "من في الدوام الآن", icon: LayoutDashboard, exact: true },
    { href: "/roster/attendance", label: "الحضور والانصراف", hint: "التأخير والغياب والساعات", icon: Clock },
  ] },
  { title: "التخطيط", items: [
    { href: "/roster/schedule", label: "جدول المناوبات", hint: "الأسبوع وطباعته", icon: CalendarDays },
    { href: "/roster/leaves", label: "الإجازات", hint: "الطلبات والأرصدة", icon: Plane },
    { href: "/roster/payroll", label: "السلف والرواتب", hint: "كشف الراتب الشهري", icon: Wallet },
  ] },
  { title: "الإدارة", items: [
    { href: "/roster/staff", label: "الكادر", hint: "الموظفون والرواتب", icon: UserCog },
    { href: "/roster/settings", label: "الإعدادات", hint: "السماحية والإجازات والنسخ", icon: Settings },
  ] },
];

function badges(): SideBadges {
  const d = todayYmd();
  const ctx = { sched: getSchedule(), shifts: getShifts(), att: getAttendance(), leaves: getLeaves(), grace: getSettings().graceMin };
  const pending = getStaff().filter((s) => s.active && dayStatus(s.id, d, ctx).status === "pending").length;
  return { "/roster/attendance": { n: pending, tone: "warn" } };
}

export function RosterSidebar() {
  return <AppSidebar appName="محطة الكادر والدوام" appTag="المناوبات · الحضور · الإجازات" icon={Users} sections={SECTIONS} getBadges={badges}
    footerNote="محطة مستقلة — بياناتها محفوظة على هذا الجهاز فقط ولا ترتبط بأي محطة أخرى." />;
}
