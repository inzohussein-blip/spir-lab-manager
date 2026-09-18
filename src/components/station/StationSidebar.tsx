"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FlaskConical, ClipboardPlus, ListChecks, FileText, Plus, Settings, LogIn,
  Archive, Boxes,
} from "lucide-react";
import { getPages, savePages, uid, type StationPage } from "@/lib/station/store";
import { cn } from "@/lib/utils";

const FIXED = [
  { href: "/station", label: "إدخال وطباعة النتائج", icon: ClipboardPlus },
  { href: "/station/tests", label: "إدارة الفحوصات", icon: ListChecks },
  { href: "/station/visits", label: "الزيارات المحفوظة", icon: FileText },
  { href: "/station/records", label: "المحفوظات (سجل المراجعين)", icon: Archive },
  { href: "/station/inventory", label: "المخزن", icon: Boxes },
  { href: "/station/settings", label: "إعدادات المحطة", icon: Settings },
];

export function StationSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pages, setPages] = useState<StationPage[]>([]);

  useEffect(() => {
    setPages(getPages());
  }, [pathname]);

  // Register the PWA service worker so the station is installable/offline.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

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

  return (
    <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-e border-line bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-4 font-bold">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
          <FlaskConical className="size-5" />
        </span>
        <div className="leading-tight">
          محطة المختبر
          <div className="text-xs font-normal text-muted">تعمل بدون إنترنت</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {FIXED.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(it.href) ? "bg-brand-light font-semibold text-brand-dark" : "text-ink hover:bg-canvas"
            )}
          >
            <it.icon className="size-4.5 shrink-0" />
            {it.label}
          </Link>
        ))}

        {pages.length > 0 && (
          <div className="mt-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            واجهات مخصّصة
          </div>
        )}
        {pages.map((p) => (
          <Link
            key={p.id}
            href={`/station/page/${p.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === `/station/page/${p.id}` ? "bg-brand-light font-semibold text-brand-dark" : "text-ink hover:bg-canvas"
            )}
          >
            <FileText className="size-4.5 shrink-0" />
            <span className="truncate">{p.title}</span>
          </Link>
        ))}

        <button
          onClick={addPage}
          className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <Plus className="size-4.5 shrink-0" /> إضافة واجهة
        </button>
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/welcome"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink"
        >
          <LogIn className="size-4" /> الصفحة الرئيسية
        </Link>
      </div>
    </aside>
  );
}
