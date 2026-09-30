"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { notifySaved } from "@/components/SettingsLayout";
import { stockOptions, setStockOptions, type StockOptions } from "@/lib/local/links";

/**
 * The pieces every station's settings page is built from, so they all read the same way:
 * a card with a title (and icon) and one line saying what it is for, then its switches.
 */
export function SettingCard({ title, icon, desc, children, testid, tone }: {
  title: string; icon?: ReactNode; desc?: ReactNode; children: ReactNode; testid?: string; tone?: "warn";
}) {
  return (
    <div className={`rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)] ${tone === "warn" ? "border-amber-300" : "border-line"}`} data-testid={testid}>
      <div className="flex items-center gap-2 text-sm font-semibold [&>svg]:size-4">{icon}{title}</div>
      {desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** A setting that is on or off: its name and what it does, and a switch. */
export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full ${checked ? "bg-brand" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "start-[22px]" : "start-0.5"}`} />
      </button>
    </label>
  );
}

/** Options that belong under a switch (shown while it is on). */
export function SubOptions({ children, grid = false }: { children: ReactNode; grid?: boolean }) {
  return <div className={`border-s-2 border-line ps-4 ${grid ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}`}>{children}</div>;
}

/**
 * «عند نفاد المادة»: one choice for the whole stock room, the same in the lab station's settings
 * and in the stock and purchases station's (see lib/local/links stockOptions).
 */
export function StockOptionsCard({ from }: { from: "station" | "purchasing" }) {
  const [o, setO] = useState<StockOptions>({});
  useEffect(() => { setO(stockOptions()); }, []);
  const set = (patch: StockOptions) => { setStockOptions(patch); setO((cur) => ({ ...cur, ...patch })); notifySaved(); };
  return (
    <SettingCard title="الحسم من المخزن" icon={<Boxes />} testid="stock-options"
      desc={<>خيار واحد للمخزن كله: يظهر نفسه في إعدادات محطة المختبر وإعدادات المخزن والمشتريات.{from === "station" && <> الأصناف وربطها بالفحوصات في <Link href="/store/items" className="text-brand-dark underline">المخزن والمشتريات ← الأصناف</Link>.</>}</>}>
      <div data-testid="stock-mode">
        <div className="text-sm font-medium">حسم المواد عند إدخال النتائج</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            ["auto", "تلقائي", "تُحسم مواد الفحص عند حفظ نتائجه في محطة المختبر، ومادة الكنترول عند كل إدخال سيطرة."],
            ["manual", "يدوي", "يصرفها الفاحص بزر «صرف المواد» في شاشة الإدخال، أو من «المخزن ← بانتظار الصرف» (النتائج وإدخالات السيطرة)."],
          ] as const).map(([v, label, hint]) => {
            const on = (o.mode ?? "auto") === v;
            return (
              <button key={v} type="button" aria-pressed={on} aria-label={`الحسم ${label}`}
                onClick={() => { if (!on) set(v === "manual" ? { mode: "manual", manualSince: Date.now() } : { mode: "auto" }); }}
                className={`rounded-xl border px-3 py-2 text-start ${on ? "border-brand bg-brand-light" : "border-line hover:bg-canvas"}`}>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[11px] text-muted">{hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Toggle
        checked={o.warnOut === true}
        onChange={(v) => set({ warnOut: v })}
        label="تحذير عند إضافة نتيجة لمادة غير متوفرة"
        desc="في شاشة الإدخال يظهر تحت الفحص «غير متوفر في المخزن» باسم المادة، وعند الحفظ تنبيه بالمواد الناقصة (تُحفظ النتيجة). وفي محطة الجودة بجانب مادة الكنترول."
      />
      <Toggle
        checked={o.allowNegative === true}
        onChange={(v) => set({ allowNegative: v })}
        label="السماح بالرصيد السالب"
        desc="يستمر العدّ تحت الصفر (مثلاً -1) بدل التوقف عند 0، فيبيّن المخزن ما استُعمل دون رصيد، ويُكمَّل عند الشراء."
      />
    </SettingCard>
  );
}
