"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-line bg-surface md:flex">
      <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold tracking-tight">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
          م
        </span>
        <div className="leading-tight">
          مختبر التحاليل
          <div className="text-xs font-normal text-muted">Spir Lab Manager</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 py-2">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-light font-semibold text-brand-dark"
                  : "text-ink hover:bg-canvas"
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
