"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { navForRole } from "@/lib/nav";

type Cmd = { label: string; href: string; hint?: string };

// Quick create/actions surfaced first in the palette.
const ACTIONS: Cmd[] = [
  { label: "مريض جديد", href: "/patients/new", hint: "إجراء" },
  { label: "طلب فحص جديد", href: "/orders/new", hint: "إجراء" },
  { label: "إضافة فحص للكتالوج", href: "/tests", hint: "إجراء" },
  { label: "إضافة كاشف / مخزون", href: "/inventory", hint: "إجراء" },
];

export function CommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all: Cmd[] = useMemo(() => {
    const pages = navForRole(role)
      .flatMap((g) => g.items)
      .map((n) => ({ label: n.label, href: n.href, hint: "صفحة" }));
    return [...ACTIONS, ...pages];
  }, [role]);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return all;
    return all.filter((c) => c.label.includes(t));
  }, [q, all]);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm text-muted hover:border-brand"
      >
        <Search className="size-4" />
        <span className="flex-1 text-right">بحث سريع…</span>
        <kbd className="rounded border border-line px-1.5 text-xs">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter" && results[active]) {
                    go(results[active].href);
                  }
                }}
                placeholder="اكتب للانتقال أو تنفيذ إجراء…"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 && (
                <div className="p-4 text-center text-sm text-muted">لا نتائج</div>
              )}
              {results.map((c, i) => (
                <button
                  key={c.href + c.label}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(c.href)}
                  className={
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm " +
                    (i === active ? "bg-brand-light text-brand-dark" : "hover:bg-canvas")
                  }
                >
                  <span>{c.label}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {c.hint}
                    {i === active && <CornerDownLeft className="size-3.5" />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
