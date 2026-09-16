"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown } from "lucide-react";

const ITEMS = [
  { label: "مريض جديد", href: "/patients/new" },
  { label: "طلب فحص جديد", href: "/orders/new" },
  { label: "فحص للكتالوج", href: "/tests" },
  { label: "كاشف / مخزون", href: "/inventory" },
];

export function NewButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        <Plus className="size-4" />
        جديد
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          {ITEMS.map((it) => (
            <Link
              key={it.href + it.label}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm hover:bg-canvas"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
