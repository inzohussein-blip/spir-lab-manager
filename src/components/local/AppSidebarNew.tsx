"use client";

import Link from "next/link";
import { Home, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SideCollapseButton, SideReopenButton } from "@/components/local/SideCollapse";
import type { SideBadge, SideBadges, SideItem, SideSection } from "@/components/local/AppSidebar";

/**
 * The station's menu in the new green look: a floating rounded card (desktop) or the same drawer
 * (phone), the active page in bold with a green bar at the edge and a dark number badge, and a dark
 * card at the bottom back to the stations. Same sections, links and badges as the classic sidebar
 * (it is drawn by `AppSidebar` from the same state).
 */
export function AppSidebarNew({
  appName, appTag, icon: AppIcon, sections, footerNote, home, open, setOpen, collapsed, setCollapsed, badges, isActive,
}: {
  appName: string; appTag: string; icon: LucideIcon; sections: SideSection[]; footerNote?: string; home: boolean;
  open: boolean; setOpen: (v: boolean) => void; collapsed: boolean; setCollapsed: (v: boolean) => void;
  badges: SideBadges; isActive: (it: SideItem) => boolean;
}) {
  return (
    <>
      {collapsed && <SideReopenButton onClick={() => setCollapsed(false)} />}
      <aside
        data-testid="side-new"
        className={cn(
          "no-print fixed inset-y-0 start-0 z-50 flex h-screen w-72 shrink-0 flex-col overflow-y-auto bg-surface p-4 shadow-[var(--shadow-pop)] transition-transform duration-200",
          "md:sticky md:top-4 md:z-auto md:m-4 md:h-[calc(100vh-2rem)] md:w-64 md:translate-x-0 md:rounded-[28px] md:shadow-[var(--shadow-card)]",
          open ? "translate-x-0" : "translate-x-full",
          collapsed && "md:hidden"
        )}
      >
        <div className="flex items-center gap-3 px-2 pb-4 pt-1">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_8px_18px_-8px_var(--color-brand)]">
            <AppIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="line-clamp-2 text-base font-extrabold">{appName}</div>
            <div className="truncate text-[11px] text-muted">{appTag}</div>
          </div>
          <SideCollapseButton onClick={() => setCollapsed(true)} />
          <button onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas md:hidden"><X className="size-4" /></button>
        </div>

        <nav className="flex flex-1 flex-col gap-3">
          {sections.map((sec) => {
            if (!sec.items.length) return null;
            return (
              <div key={sec.title}>
                <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted">{sec.title}</div>
                <div className="flex flex-col gap-0.5">
                  {sec.items.map((it) => {
                    const active = isActive(it);
                    const Icon = it.icon;
                    const bs = ([] as SideBadge[]).concat(badges[it.href] ?? []).filter((x) => x.n > 0);
                    return (
                      <Link key={it.href} href={it.href} title={it.hint} aria-current={active ? "page" : undefined}
                        className={cn("relative flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors", active ? "font-bold text-ink" : "text-muted hover:bg-canvas hover:text-ink")}>
                        {active && <span className="absolute inset-y-2 -start-4 w-1 rounded-e-full bg-brand" />}
                        <Icon className={cn("size-[18px] shrink-0", active && "text-brand")} />
                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        {bs.map((b, i) => (
                          <span key={i} data-testid={b.testid} title={b.title}
                            className={cn("grid min-w-5 place-items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums", b.tone === "danger" ? "bg-red-600 text-white" : b.tone === "warn" ? "bg-amber-500 text-white" : "bg-brand-dark text-white")}>{b.n}</span>
                        ))}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-4">
          {/* The dark card at the bottom: the station's note, and back to the stations. */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e5530] to-[#06331c] p-3.5 text-white" data-testid="side-card">
            <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.12]" aria-hidden>
              <defs><pattern id="side-wave" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M0 13 Q6.5 0 13 13 T26 13" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#side-wave)" />
            </svg>
            <div className="relative">
              <span className="grid size-8 place-items-center rounded-full bg-white/15"><AppIcon className="size-4" /></span>
              <div className="mt-2 text-sm font-bold leading-snug">{appName}</div>
              {footerNote && <div className="text-[11px] leading-5 text-white/75">{footerNote}</div>}
            </div>
            {home && (
              <Link href="/welcome" className="relative mt-2.5 flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#1a8a50] to-[#0e6b3c] px-3 py-2 text-xs font-semibold text-white shadow-inner hover:brightness-110"><Home className="size-4" /> الصفحة الرئيسية</Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
