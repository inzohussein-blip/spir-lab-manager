"use client";

import { useEffect, useState } from "react";
import { Settings, Type, Lock } from "lucide-react";
import { ThemeCard } from "@/components/local/LocalTheme";
import { THEME_KEYS } from "@/lib/local/theme";
import { TEXT_SIZES, readTextSize, saveTextSize, type TextSizeId } from "@/components/about/TextSize";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";

/** Very simple settings: the look and the text size. The text itself is fixed. */
export default function AboutSettings() {
  const [size, setSize] = useState<TextSizeId>("normal");
  useEffect(() => { setSize(readTextSize()); }, []);

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Settings className="size-6 text-brand" /> الإعدادات</h1>

      <ThemeCard storageKey={THEME_KEYS.about} note="فاتح أو غامق، أو تلقائي حسب إعداد الجهاز. يخص هذه المحطة فقط." />

      <section className={card} data-testid="about-text-size">
        <div className="mb-1 flex items-center gap-2 font-bold"><Type className="size-4 text-brand-dark" /> حجم الخط</div>
        <p className="mb-3 text-xs text-muted">لقراءة أريح. يُحفظ على هذا الجهاز فقط.</p>
        <div className="flex flex-wrap gap-2">
          {TEXT_SIZES.map((s) => (
            <button key={s.id} type="button" aria-pressed={size === s.id} onClick={() => { setSize(s.id); saveTextSize(s.id); }}
              className={cn("rounded-lg border px-4 py-2 text-sm", size === s.id ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line hover:bg-canvas")}
              style={{ fontSize: `${0.875 * s.zoom}rem` }}>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-xl bg-canvas px-4 py-3 text-xs text-muted">
        <Lock className="mt-0.5 size-4 shrink-0" />
        محتوى هذه المحطة ثابت: الشرح والصور لا تُعدَّل، ويُحدَّث مع كل إصدار جديد من التطبيق.
      </p>
    </div>
  );
}
