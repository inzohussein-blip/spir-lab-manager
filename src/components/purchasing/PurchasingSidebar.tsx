"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Truck, Settings, Home, FileBarChart } from "lucide-react";
import { cn } from "@/lib/utils";

const FIXED = [
  { href: "/store", label: "المشتريات", icon: ShoppingCart },
  { href: "/store/report", label: "التقارير (شهري/سنوي)", icon: FileBarChart },
  { href: "/store/suppliers", label: "الموردون", icon: Truck },
  { href: "/store/settings", label: "الإعدادات والنسخ الاحتياطي", icon: Settings },
];

export function PurchasingSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/store" ? pathname === "/store" : pathname.startsWith(href);

  return (
    <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-line bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-4 font-bold">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm">
          <ShoppingCart className="size-5" />
        </span>
        <div className="leading-tight">
          منظومة المشتريات
          <div className="text-xs font-normal text-muted">نسخة محلية — بدون إنترنت</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {FIXED.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(it.href) ? "bg-amber-100 font-semibold text-amber-800" : "text-ink hover:bg-canvas"
            )}
          >
            <it.icon className="size-4.5 shrink-0" />
            {it.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <Link href="/welcome" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink">
          <Home className="size-4" /> الصفحة الرئيسية
        </Link>
      </div>
    </aside>
  );
}
