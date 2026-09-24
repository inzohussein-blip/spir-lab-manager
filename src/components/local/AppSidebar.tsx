"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, X, ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SideItem { href: string; label: string; hint: string; icon: LucideIcon; exact?: boolean }
export interface SideSection { title: string; items: SideItem[] }
export type SideBadges = Record<string, { n: number; tone?: "brand" | "warn" | "danger" }>;

/**
 * Sidebar shared by the standalone local stations (quality, roster…). Each
 * station passes its own sections and a badge function; data never mixes.
 * Desktop: sticky column. Phone: top bar + slide-in drawer.
 */
export function AppSidebar({
  appName, appTag, icon: AppIcon, sections, getBadges, footerNote,
}: {
  appName: string;
  appTag: string;
  icon: LucideIcon;
  sections: SideSection[];
  getBadges?: () => SideBadges;
  footerNote?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState<SideBadges>({});

  useEffect(() => {
    setOpen(false);
    if (getBadges) setBadges(getBadges());
  }, [pathname, getBadges]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (it: SideItem) => (it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/"));
  const current = sections.flatMap((s) => s.items).find(isActive)?.label ?? appName;

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
        <button onClick={() => setOpen(true)} aria-label="فتح القائمة" className="grid size-10 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas">
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{current}</div>
          <div className="text-[11px] text-muted">{appName}</div>
        </div>
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white"><AppIcon className="size-[18px]" /></span>
      </div>

      <div onClick={() => setOpen(false)} className={cn("no-print fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} />

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
              <AppIcon className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[15px] font-bold">{appName}</div>
              <div className="mt-1 inline-flex rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-dark">{appTag}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"><X className="size-4" /></button>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
          {sections.map((sec) => (
            <div key={sec.title}>
              <div className="mb-1.5 flex items-center gap-2 px-2.5 text-[11px] font-semibold text-muted">{sec.title}<span className="h-px flex-1 bg-line" /></div>
              <div className="flex flex-col gap-1">
                {sec.items.map((it) => {
                  const active = isActive(it);
                  const Icon = it.icon;
                  const b = badges[it.href];
                  return (
                    <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
                      className={cn("group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm",
                        active ? "bg-brand-light text-brand-dark shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]" : "text-ink hover:bg-canvas")}>
                      {active && <span className="absolute inset-y-2 -start-3 w-1 rounded-e-full bg-brand" />}
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                        active ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "bg-canvas text-muted ring-1 ring-line group-hover:bg-brand-light group-hover:text-brand group-hover:ring-transparent")}>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className={cn("block truncate", active && "font-semibold")}>{it.label}</span>
                        <span className={cn("block truncate text-[11px]", active ? "text-brand-dark/70" : "text-muted")}>{it.hint}</span>
                      </span>
                      {b && b.n > 0 ? (
                        <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none tabular-nums",
                          b.tone === "danger" ? "bg-red-600 text-white" : b.tone === "warn" ? "bg-amber-500 text-white" : "bg-brand-light text-brand-dark")}>{b.n}</span>
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
          {footerNote && <p className="mb-2 rounded-xl bg-canvas px-3 py-2 text-[11px] text-muted">{footerNote}</p>}
          <Link href="/welcome" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink"><Home className="size-4" /> الصفحة الرئيسية</Link>
        </div>
      </aside>
    </>
  );
}
