"use client";

import { useCallback, useEffect } from "react";
import { Stethoscope, FileText, Building2, Settings } from "lucide-react";
import { AppSidebar, type SideBadges, type SideSection } from "@/components/local/AppSidebar";
import { newCount, startDoctorRefresh, useDoctor } from "@/lib/doctors/viewer";

const SECTIONS: SideSection[] = [
  { title: "النتائج", items: [
    { href: "/doctor", label: "نتائج المراجعين", hint: "من كل المختبرات المضافة", icon: FileText, exact: true },
    { href: "/doctor/labs", label: "المختبرات", hint: "إضافة رمز مختبر", icon: Building2 },
  ] },
  { title: "الإدارة", items: [
    { href: "/doctor/settings", label: "الإعدادات", hint: "المظهر ورمز الدخول والخروج", icon: Settings },
  ] },
];

/** «نافذة الأطباء»'s menu: the number of new results beside «نتائج المراجعين»; also starts the refresh. */
export function DoctorSidebar() {
  const rev = useDoctor();
  useEffect(() => { startDoctorRefresh(); }, []);
  const badges = useCallback((): SideBadges => {
    void rev;
    return { "/doctor": { n: newCount(), tone: "danger", testid: "menu-new-results" } };
  }, [rev]);
  return <AppSidebar appName="نافذة الأطباء" appTag="نتائج مراجعيك من المختبر" icon={Stethoscope} sections={SECTIONS} getBadges={badges} home={false}
    footerNote="النتائج تصل مشفّرة ولا يفتحها إلا رمزك، وتُحفظ على هذا الجهاز فقط." />;
}
