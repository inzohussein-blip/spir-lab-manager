"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, ScanBarcode, X } from "lucide-react";
import type { StationTest } from "@/lib/station/store";

/** Shared by «المخزن» and «الأصناف» of the stock and purchases station. */
export const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** Pick the lab station's tests that use a stock item (search + ticks, grouped by department). */
export function TestPicker({ tests, value, onChange }: { tests: StationTest[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const on = new Set(value);
  const term = q.trim().toLowerCase();
  const shown = tests.filter((t) => !term || t.name_ar.toLowerCase().includes(term) || (t.name_en ?? "").toLowerCase().includes(term) || (t.category ?? "").includes(q.trim()));
  const groups = new Map<string, StationTest[]>();
  for (const t of shown) groups.set(t.category || "أخرى", [...(groups.get(t.category || "أخرى") ?? []), t]);
  const toggle = (id: string) => onChange(on.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div data-testid="test-picker" className="rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فحص من محطة المختبر…" aria-label="بحث في الفحوصات" className="w-full bg-transparent py-2 text-sm outline-none" />
        <span className="shrink-0 text-xs text-muted tabular-nums">{value.length} مختار</span>
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="shrink-0 text-xs text-red-600 hover:underline">مسح</button>}
      </div>
      <div className="max-h-48 overflow-y-auto p-2">
        {[...groups].map(([cat, list]) => (
          <div key={cat} className="mb-1.5">
            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-muted">
              {cat}
              <button type="button" onClick={() => onChange(Array.from(new Set([...value, ...list.map((t) => t.id)])))} className="font-normal text-amber-700 hover:underline">الكل</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {list.map((t) => (
                <label key={t.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${on.has(t.id) ? "border-amber-400 bg-amber-50 text-amber-800" : "border-line hover:bg-canvas"}`}>
                  <input type="checkbox" checked={on.has(t.id)} onChange={() => toggle(t.id)} className="size-3" aria-label={t.name_ar} /> {t.name_ar}
                </label>
              ))}
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="px-1 py-2 text-xs text-muted">لا فحوصات مطابقة.</p>}
      </div>
    </div>
  );
}

export function Tile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const c = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-amber-700";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}


/**
 * «امسح الباركود» (Settings → «الباركود»): a barcode reader types the code and presses Enter; the
 * code is handed on and the box cleared for the next scan. Typing a code by hand works the same.
 */
export function ScanBox({ onScan, hint, testid = "scan-box" }: { onScan: (code: string) => string | void; hint?: string; testid?: string }) {
  const [v, setV] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testid}>
      <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-surface px-3">
        <ScanBarcode className="size-4 text-amber-700" />
        <input value={v} onChange={(e) => setV(e.target.value)} aria-label="امسح الباركود"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const code = v.trim();
            if (!code) return;
            setMsg(onScan(code) || "");
            setV("");
          }}
          placeholder={hint ?? "امسح الباركود هنا…"} className="w-full bg-transparent py-2 text-sm outline-none" dir="ltr" />
      </label>
      {msg && <span className="text-xs text-amber-800" role="status">{msg}</span>}
    </div>
  );
}

/** A window over the page for one task (add an item, record a purchase…); Esc or ✕ closes it. */
export function Modal({ title, onClose, children, testid, wide = false }: { title: ReactNode; onClose: () => void; children: ReactNode; testid?: string; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="no-print fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-8" role="dialog" aria-modal="true" data-testid={testid}>
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]`}>
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1 truncate text-base font-bold">{title}</div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** A row of filter chips with counts (the chosen one filled). */
export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string, number?][]; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={label}>
      {options.map(([v, text, n]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1.5 text-sm ${value === v ? "bg-amber-600 font-semibold text-white" : "border border-line bg-surface hover:bg-canvas"}`}>
          {text}{n != null && <span className={`ms-1.5 tabular-nums ${value === v ? "text-white/80" : "text-muted"}`}>{n}</span>}
        </button>
      ))}
    </div>
  );
}
