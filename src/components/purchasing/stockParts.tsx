"use client";

import { useState } from "react";
import { Search } from "lucide-react";
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

