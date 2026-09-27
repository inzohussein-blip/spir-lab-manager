"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** The lab's mark: its own logo when it has one, otherwise the first letter of its name. */
export function LabMark({ lab, className }: { lab: { name: string; logo: string }; className: string }) {
  if (lab.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={lab.logo} alt="" data-testid="lab-mark" className={cn(className, "bg-white object-contain p-0.5 ring-1 ring-line")} />;
  }
  return (
    <span className={cn(className, "grid place-items-center bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm")}>
      {lab.name.trim().charAt(0) || "م"}
    </span>
  );
}

export function Sidebar({ role, lab }: { role: string; lab: { name: string; logo: string } }) {
  const pathname = usePathname();
  const groups = navForRole(role);

  // The active item is the one whose href is the *longest* prefix of the current
  // path, so /orders/new highlights "طلب فحص جديد" and not also "سجل العيّنات".
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const bestMatch = hrefs
    .filter((h) => h !== "/" && (pathname === h || pathname.startsWith(h + "/")))
    .reduce((a, b) => (b.length > a.length ? b : a), "");
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === bestMatch;
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-line bg-surface md:flex">
      <div className="flex items-center gap-2.5 px-5 py-4 text-lg font-bold tracking-tight">
        <LabMark lab={lab} className="size-9 shrink-0 rounded-xl" />
        <div className="min-w-0 leading-tight">
          <span className="line-clamp-2" data-testid="lab-name">{lab.name}</span>
          <div className="text-xs font-normal text-muted">Medical Lab</div>
        </div>
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
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
