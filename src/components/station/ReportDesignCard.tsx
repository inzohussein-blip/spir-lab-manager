"use client";

import { Check, LayoutTemplate } from "lucide-react";
import { SettingCard } from "@/components/local/SettingsParts";
import { REPORT_DESIGNS, type ReportDesign } from "@/lib/station/reportExtras";
import { tableStyleOf, reportColors, tint, PURPLE, GOLD } from "@/lib/station/tableStyle";
import type { StationSettings } from "@/lib/station/store";

/** The colours that suit «الموجة» (the last ready pair in REPORT_PALETTES). */
const WAVE_COLORS = { primary: "#1f9a7a", accent: "#3a8fcf" };

/** A small drawing of each design, in the lab's own colours. */
function Mini({ design, primary, accent }: { design: ReportDesign; primary: string; accent: string }) {
  const c = reportColors({ ...tableStyleOf(), primary, accent });
  const lines = (y: number) => [0, 1, 2, 3].map((i) => <rect key={i} x="14" y={y + i * 7} width="52" height="3" rx="1" fill="#e5e7eb" />);
  return design === "wave" ? (
    <svg viewBox="0 0 80 104" className="h-32 w-[6.2rem] shrink-0 rounded border border-line bg-white shadow-sm" aria-hidden>
      <path d="M0 0 H48 C36 3 22 7 12 12 C6 15 2 17 0 18 Z" fill={tint(accent, 0.65)} />
      <path d="M0 8 C14 3 30 2 46 4 C30 6 16 11 0 16 Z" fill={tint(primary, 0.7)} opacity="0.7" />
      <path d="M26 7 H62 l1 -2 l1 4 l1 -5 l1 3 H72" stroke={tint(accent, 0.45)} strokeWidth="0.6" fill="none" />
      <rect x="22" y="15" width="36" height="5" rx="1.5" fill={c.title} />
      <rect x="28" y="22" width="24" height="2.5" rx="1" fill={c.subtitle} />
      <rect x="8" y="28" width="64" height="0.6" fill={c.border} />
      <rect x="10" y="33" width="60" height="8" rx="1.5" fill="none" stroke={c.border} strokeWidth="0.8" />
      <rect x="10" y="45" width="60" height="4" fill={c.header} />
      {lines(52)}
      <rect x="28" y="84" width="24" height="0.5" fill={c.border} />
      <rect x="30" y="86" width="20" height="2" rx="1" fill="#9ca3af" />
      <path d="M0 96 C20 100 45 100 62 97 C70 95 76 92 80 89 V104 H0 Z" fill={tint(accent, 0.65)} />
      <path d="M0 99 C24 103 50 103 80 96 V104 H0 Z" fill={tint(primary, 0.7)} opacity="0.7" />
    </svg>
  ) : (
    <svg viewBox="0 0 80 104" className="h-32 w-[6.2rem] shrink-0 rounded border border-line bg-white shadow-sm" aria-hidden>
      <rect x="8" y="8" width="10" height="10" rx="2" fill={tint(c.title, 0.75)} />
      <rect x="21" y="9" width="26" height="4.5" rx="1.5" fill={c.title} />
      <rect x="21" y="15" width="18" height="2.5" rx="1" fill={c.subtitle} />
      <rect x="56" y="9" width="16" height="7" rx="1" fill="#d1d5db" />
      <rect x="8" y="22" width="64" height="1.6" rx="0.8" fill={c.border} />
      <rect x="10" y="27" width="60" height="8" rx="1.5" fill="none" stroke={c.border} strokeWidth="1" />
      <rect x="10" y="39" width="60" height="4" fill={c.header} />
      {lines(46)}
      <rect x="10" y="90" width="60" height="6" rx="1.5" fill={c.bar} />
    </svg>
  );
}

/** Settings → «التقرير المطبوع ← تصميم التقرير»: the classic letterhead or «الموجة». */
export function ReportDesignCard({ settings, onDesign, onColors }: {
  settings: StationSettings;
  onDesign: (d: ReportDesign) => void;
  onColors: (c: { primary: string; accent: string }) => void;
}) {
  const ts = tableStyleOf(settings.reportTable);
  const current: ReportDesign = settings.reportDesign === "wave" ? "wave" : "classic";
  const original = ts.primary === PURPLE && ts.accent === GOLD;
  return (
    <SettingCard title="تصميم التقرير" icon={<LayoutTemplate />} testid="report-design"
      desc="شكل الورقة كلها. الألوان والجدول والخط من بطاقاتها أدناه، ويعمل كل منها مع أي تصميم.">
      <div role="radiogroup" aria-label="تصميم التقرير" className="grid grid-cols-2 gap-3">
        {REPORT_DESIGNS.map((d) => {
          const on = current === d.id;
          return (
            <button key={d.id} type="button" role="radio" aria-checked={on} data-testid={`report-design-${d.id}`} onClick={() => onDesign(d.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors ${on ? "border-brand bg-brand-light" : "border-line hover:bg-canvas"}`}>
              <Mini design={d.id} primary={ts.primary} accent={ts.accent} />
              <span className="min-w-0">
                <span className="flex items-center justify-center gap-1.5 text-sm font-bold">{on && <Check className="size-4 shrink-0 text-brand" />}{d.name}</span>
                <span className="mt-1 block text-xs text-muted">{d.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {current === "wave" && settings.prePrinted === true && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">«الطباعة على ورق المختبر المطبوع مسبقاً» مفعّلة، فيُطبع بلا رأس ولا موجات. أوقفها من «الورق والشعار والخط» ليظهر التصميم.</p>
      )}
      {current === "wave" && original && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs" data-testid="report-design-colors">
          <span className="flex-1">تُرسم الموجات بألوان تقريرك. ألوان «تيل وأزرق» تناسب هذا التصميم أكثر:</span>
          <button type="button" onClick={() => onColors(WAVE_COLORS)} className="rounded-md border border-line bg-surface px-2.5 py-1 font-semibold hover:bg-canvas">استعمالها</button>
        </p>
      )}
    </SettingCard>
  );
}
