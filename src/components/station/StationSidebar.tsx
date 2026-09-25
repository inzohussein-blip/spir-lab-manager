"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FlaskConical, ClipboardPlus, ListChecks, FileText, Plus, Settings, Home,
  Archive, Boxes, Menu, X, ChevronLeft, type LucideIcon,
} from "lucide-react";
import { getPages, savePages, getVisits, getStock, daysToExpiry, requestPersistentStorage, uid, type StationPage } from "@/lib/station/store";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; hint: string; icon: LucideIcon }

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "العمل اليومي",
    items: [
      { href: "/station", label: "إدخال وطباعة النتائج", hint: "مريض جديد ونتائجه", icon: ClipboardPlus },
      { href: "/station/visits", label: "الزيارات المحفوظة", hint: "بحث وطباعة وتعديل", icon: FileText },
      { href: "/station/records", label: "سجل المراجعين", hint: "التاريخ الكامل للمريض", icon: Archive },
    ],
  },
  {
    title: "الإدارة",
    items: [
      { href: "/station/tests", label: "إدارة الفحوصات", hint: "الأسماء والمعدلات", icon: ListChecks },
      { href: "/station/inventory", label: "المخزن", hint: "الكميات والصلاحية", icon: Boxes },
      { href: "/station/settings", label: "الإعدادات", hint: "الترويسة والنسخ", icon: Settings },
    ],
  },
];

function NavLink({
  href, label, hint, icon: Icon, active, badge, badgeTone = "brand",
}: NavItem & { active: boolean; badge?: number; badgeTone?: "brand" | "warn" }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm",
        active
          ? "bg-brand-light text-brand-dark shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]"
          : "text-ink hover:bg-canvas"
      )}
    >
      {active && <span className="absolute inset-y-2 -start-3 w-1 rounded-e-full bg-brand" />}
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
          active
            ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_4px_10px_-2px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]"
            : "bg-canvas text-muted ring-1 ring-line group-hover:bg-brand-light group-hover:text-brand group-hover:ring-transparent"
        )}
      >
        <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className={cn("block truncate", active && "font-semibold")}>{label}</span>
        <span className={cn("block truncate text-[11px]", active ? "text-brand-dark/70" : "text-muted")}>{hint}</span>
      </span>
      {badge ? (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none tabular-nums",
            badgeTone === "warn" ? "bg-amber-500 text-white" : "bg-brand text-white"
          )}
        >
          {badge}
        </span>
      ) : (
        <ChevronLeft className={cn("size-4 shrink-0 transition-all", active ? "text-brand opacity-100" : "text-muted opacity-0 group-hover:-translate-x-0.5 group-hover:opacity-60")} />
      )}
    </Link>
  );
}

export function StationSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pages, setPages] = useState<StationPage[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [stockAlerts, setStockAlerts] = useState(0);
  const [open, setOpen] = useState(false); // mobile drawer

  useEffect(() => {
    setPages(getPages());
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    setTodayCount(getVisits().filter((v) => v.created_at >= start.getTime()).length);
    setStockAlerts(
      getStock().filter((s) => {
        const d = daysToExpiry(s.expiry);
        return (s.minQty != null && Number(s.qty) <= Number(s.minQty)) || (d != null && d <= 30);
      }).length
    );
    setOpen(false);
  }, [pathname]);

  // Offline support is registered by <OfflineReady /> in the layout.
  useEffect(() => {
    // Keep station data from being auto-evicted by the browser.
    void requestPersistentStorage();
  }, []);

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function addPage() {
    const title = window.prompt("اسم الواجهة الجديدة:");
    if (!title || !title.trim()) return;
    const p: StationPage = { id: uid(), title: title.trim(), content: "" };
    const next = [...getPages(), p];
    savePages(next);
    setPages(next);
    router.push(`/station/page/${p.id}`);
  }

  const isActive = (href: string) =>
    href === "/station" ? pathname === "/station" : pathname.startsWith(href);

  const current = SECTIONS.flatMap((s) => s.items).find((it) => isActive(it.href))?.label
    ?? pages.find((p) => pathname === `/station/page/${p.id}`)?.title
    ?? "محطة المختبر";

  // Computed in the browser: a page saved for offline use must not show the day it was saved.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("ar-IQ-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }));
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          className="grid size-10 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{current}</div>
          <div className="text-[11px] text-muted">محطة المختبر</div>
        </div>
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white">
          <FlaskConical className="size-[18px]" />
        </span>
      </div>

      {/* Mobile backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "no-print fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "no-print fixed inset-y-0 start-0 z-50 flex h-screen w-72 shrink-0 flex-col border-e border-line bg-surface shadow-[var(--shadow-pop)] transition-transform duration-200",
          "md:sticky md:top-0 md:z-auto md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="relative px-4 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--color-brand)_60%,transparent)]">
              <FlaskConical className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[15px] font-bold">محطة المختبر</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                تعمل بدون إنترنت
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق القائمة"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"
            >
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
                {sec.items.map((it) => (
                  <NavLink
                    key={it.href}
                    {...it}
                    active={isActive(it.href)}
                    badge={it.href === "/station/visits" ? todayCount : it.href === "/station/inventory" ? stockAlerts : undefined}
                    badgeTone={it.href === "/station/inventory" ? "warn" : "brand"}
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <div className="mb-1.5 flex items-center gap-2 px-2.5 text-[11px] font-semibold text-muted">
              واجهات مخصّصة
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="flex flex-col gap-1">
              {pages.map((p) => (
                <NavLink
                  key={p.id}
                  href={`/station/page/${p.id}`}
                  label={p.title}
                  hint="واجهة مخصّصة"
                  icon={FileText}
                  active={pathname === `/station/page/${p.id}`}
                />
              ))}
              <button
                onClick={addPage}
                className="flex items-center gap-3 rounded-xl border border-dashed border-line px-2.5 py-2 text-sm text-muted hover:border-brand hover:bg-brand-light/50 hover:text-brand-dark"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-canvas">
                  <Plus className="size-[18px]" />
                </span>
                إضافة واجهة
              </button>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-line p-3">
          <div className="mb-2 rounded-xl bg-canvas px-3 py-2 text-[11px] text-muted">
            <div className="font-medium text-ink">{today}</div>
            <div>
              اليوم: <b className="tabular-nums text-brand-dark">{todayCount}</b> زيارة
              {stockAlerts > 0 && <> · <b className="tabular-nums text-amber-600">{stockAlerts}</b> تنبيه مخزن</>}
            </div>
          </div>
          <Link
            href="/welcome"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink"
          >
            <Home className="size-4" /> الصفحة الرئيسية
          </Link>
        </div>
      </aside>
    </>
  );
}
