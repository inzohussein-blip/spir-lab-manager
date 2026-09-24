"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap, Library, FilePlus2, TestTubes, Wrench, Images, Settings, Home, Menu, X, ChevronLeft, type LucideIcon,
} from "lucide-react";
import { getTests, getTubes, getTools } from "@/lib/training/store";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; hint: string; icon: LucideIcon; exact?: boolean }

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "المعرفة",
    items: [
      { href: "/training", label: "مكتبة الفحوصات", hint: "البروسيجر والتفسير والربط", icon: Library, exact: true },
      { href: "/training/edit", label: "إضافة فحص", hint: "بطاقة فحص جديدة", icon: FilePlus2 },
    ],
  },
  {
    title: "المراجع",
    items: [
      { href: "/training/tubes", label: "التيوبات والحاويات", hint: "الألوان والمواد وترتيب السحب", icon: TestTubes },
      { href: "/training/tools", label: "الأدوات والأجهزة", hint: "الأجهزة والكواشف والمستهلكات", icon: Wrench },
      { href: "/training/media", label: "مكتبة الصور", hint: "صور العينات والنتائج", icon: Images },
    ],
  },
  {
    title: "الإدارة",
    items: [{ href: "/training/settings", label: "الإعدادات", hint: "الترويسة والسلامة والنسخ", icon: Settings }],
  },
];

export function TrainingSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ tests: 0, tubes: 0, tools: 0 });

  useEffect(() => {
    setCounts({ tests: getTests().length, tubes: getTubes().length, tools: getTools().length });
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (it: NavItem) =>
    it.exact ? pathname === it.href || pathname.startsWith("/training/test") : pathname.startsWith(it.href);
  const current = SECTIONS.flatMap((s) => s.items).find(isActive)?.label ?? "محطة التدريب";

  return (
    <>
      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
        <button onClick={() => setOpen(true)} aria-label="فتح القائمة" className="grid size-10 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas">
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{current}</div>
          <div className="text-[11px] text-muted">محطة التدريب والمعلومات</div>
        </div>
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white">
          <GraduationCap className="size-[18px]" />
        </span>
      </div>

      <div
        onClick={() => setOpen(false)}
        className={cn("no-print fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />

      <aside
        className={cn(
          "no-print fixed inset-y-0 start-0 z-50 flex h-screen w-72 shrink-0 flex-col border-e border-line bg-surface shadow-[var(--shadow-pop)] transition-transform duration-200",
          "md:sticky md:top-0 md:z-auto md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="px-4 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--color-brand)_60%,transparent)]">
              <GraduationCap className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[15px] font-bold">محطة التدريب</div>
              <div className="mt-1 inline-flex rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">والمعلومات — عصارة الخبرة</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className="mb-1.5 flex items-center gap-2 px-2.5 text-[11px] font-semibold text-muted">
                {sec.title}
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="flex flex-col gap-1">
                {sec.items.map((it) => {
                  const active = isActive(it);
                  const Icon = it.icon;
                  const badge = it.href === "/training" ? counts.tests : it.href === "/training/tubes" ? counts.tubes : it.href === "/training/tools" ? counts.tools : 0;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm",
                        active ? "bg-brand-light text-brand-dark shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]" : "text-ink hover:bg-canvas"
                      )}
                    >
                      {active && <span className="absolute inset-y-2 -start-3 w-1 rounded-e-full bg-brand" />}
                      <span className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                        active ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "bg-canvas text-muted ring-1 ring-line group-hover:bg-brand-light group-hover:text-brand group-hover:ring-transparent"
                      )}>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className={cn("block truncate", active && "font-semibold")}>{it.label}</span>
                        <span className={cn("block truncate text-[11px]", active ? "text-brand-dark/70" : "text-muted")}>{it.hint}</span>
                      </span>
                      {badge > 0 ? (
                        <span className="min-w-5 rounded-full bg-brand-light px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-brand-dark tabular-nums">{badge}</span>
                      ) : (
                        <ChevronLeft className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted opacity-0 group-hover:opacity-60")} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <p className="mb-2 rounded-xl bg-canvas px-3 py-2 text-[11px] text-muted">
            محطة مستقلة — بياناتها محفوظة على هذا الجهاز فقط ولا ترتبط بمحطة المختبر.
          </p>
          <Link href="/welcome" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink">
            <Home className="size-4" /> الصفحة الرئيسية
          </Link>
        </div>
      </aside>
    </>
  );
}
