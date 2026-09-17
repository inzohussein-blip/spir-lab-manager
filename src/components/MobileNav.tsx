"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FlaskConical } from "lucide-react";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const groups = navForRole(role);

  // Longest-prefix match so nested routes highlight the most specific item.
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const bestMatch = hrefs
    .filter((h) => h !== "/" && (pathname === h || pathname.startsWith(h + "/")))
    .reduce((a, b) => (b.length > a.length ? b : a), "");
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === bestMatch;

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="القائمة"
        className="grid size-9 place-items-center rounded-lg border border-line text-ink hover:bg-canvas"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative h-full w-72 overflow-y-auto border-e border-line bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5 font-bold">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white">
                  <FlaskConical className="size-5" />
                </span>
                مختبر التحليلات المرضية
              </div>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-canvas">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-4 px-3 py-2">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                            active ? "bg-brand-light font-semibold text-brand-dark" : "text-ink hover:bg-canvas"
                          )}
                        >
                          <item.icon className="size-4.5 shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
