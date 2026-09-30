"use client";

import { Palette, RotateCcw, Check } from "lucide-react";
import type { StationSettings } from "@/lib/station/store";
import { tableStyleOf, reportColors, ORIGINAL_TABLE, REPORT_PALETTES, type TableStyle } from "@/lib/station/tableStyle";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** How light a #rrggbb colour is (0 black … 1 white). */
const lightness = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Settings card: the printed report's colours (the lab's own, or the original) and the look of
 *  its results table, with a live preview. */
export function TableStyleCard({ settings, onChange }: { settings: StationSettings; onChange: (t: TableStyle) => void }) {
  const ts = tableStyleOf(settings.reportTable);
  const set = (patch: Partial<TableStyle>) => onChange({ ...ts, ...patch });
  const isOriginal = JSON.stringify(ts) === JSON.stringify(ORIGINAL_TABLE);
  const c = reportColors(ts);
  const palette = REPORT_PALETTES.find((p) => p.primary === ts.primary && p.accent === ts.accent);
  const tooLight = lightness(c.header) > 0.62;

  const sel = (label: string, value: string, options: [string, string][], on: (v: string) => void) => (
    <label className="text-xs text-muted">{label}
      <select value={value} onChange={(e) => on(e.target.value)} className={`mt-1 ${inp}`}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Palette className="size-4" /> التقرير المطبوع: الألوان والجدول</div>
      <p className="mb-4 text-xs text-muted">ألوان المختبر تظهر في رأس التقرير والجدول والاستمارات (الإدرار، الخروج، السائل المنوي، الزرع) وتذييل الصفحة. تظهر التعديلات فوراً في المعاينة بجانب الإعدادات وفي ورقة النتائج (A4 وA5).</p>

      <div className="mb-4" data-testid="report-colors">
        <div className="mb-2 text-xs text-muted">ألوان جاهزة</div>
        <div className="flex flex-wrap gap-2">
          {REPORT_PALETTES.map((p) => {
            const on = p === palette;
            return (
              <button key={p.name} type="button" onClick={() => set({ primary: p.primary, accent: p.accent })} aria-pressed={on} aria-label={p.name} title={p.name}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${on ? "border-brand bg-canvas font-semibold" : "border-line hover:bg-canvas"}`}>
                <span className="relative inline-flex">
                  <span className="size-5 rounded-full border border-black/10" style={{ background: p.primary }} />
                  <span className="-ms-1.5 size-5 rounded-full border border-white" style={{ background: p.accent }} />
                </span>
                {p.name}
                {on && <Check className="size-3.5" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="color" value={ts.primary} onChange={(e) => set({ primary: e.target.value })} aria-label="اللون الرئيسي" className="h-9 w-12 cursor-pointer rounded border border-line bg-surface p-0.5" />
            <span>اللون الرئيسي<span className="block text-[10px]">اسم المختبر، رأس الجدول، التذييل</span></span>
            <span className="ms-auto font-mono text-[11px] text-ink" dir="ltr">{ts.primary}</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="color" value={ts.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="اللون الثانوي" className="h-9 w-12 cursor-pointer rounded border border-line bg-surface p-0.5" />
            <span>اللون الثانوي<span className="block text-[10px]">الخط الفاصل، الإطارات، عناوين الأقسام</span></span>
            <span className="ms-auto font-mono text-[11px] text-ink" dir="ltr">{ts.accent}</span>
          </label>
        </div>
        {!palette && <p className="mt-2 text-[11px] text-muted">ألوان خاصة بالمختبر.</p>}
        {tooLight && <p className="mt-2 text-[11px] text-amber-700" data-testid="color-warning">اللون الرئيسي فاتح: قد يصعب قراءة الكتابة البيضاء فوقه في رأس الجدول والتذييل. اختر لوناً أغمق أو ارفع شدة الألوان.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted sm:col-span-2">
          <span className="flex items-center justify-between">شدة الألوان <b className="tabular-nums text-ink" dir="ltr">{ts.intensity}%</b></span>
          <input type="range" min={70} max={150} step={5} value={ts.intensity} onChange={(e) => set({ intensity: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--color-brand)]" aria-label="شدة الألوان" />
          <span className="flex justify-between text-[10px]"><span>أفتح</span><span>أغمق</span></span>
          <span className="mt-0.5 block text-[10px]">100% = ألوان الشكل الأصلي</span>
        </label>
        {sel("حجم الخط", String(ts.fontSize), [["12", "صغير جداً"], ["13", "صغير"], ["14", "متوسط (الأصلي)"], ["15", "كبير"], ["16", "كبير جداً"]], (v) => set({ fontSize: Number(v) }))}
        {sel("خط أسماء الفحوصات", ts.nameWeight, [["normal", "عادي"], ["medium", "متوسط (الأصلي)"], ["bold", "عريض"]], (v) => set({ nameWeight: v as TableStyle["nameWeight"] }))}
        {sel("نمط الجدول", ts.layout, [["striped", "صفوف متناوبة الألوان (الأصلي)"], ["lines", "خطوط أفقية"], ["grid", "شبكة كاملة"], ["plain", "بسيط بلا خطوط"]], (v) => set({ layout: v as TableStyle["layout"] }))}
        {sel("ارتفاع الصفوف", ts.density, [["compact", "مضغوط"], ["normal", "عادي (الأصلي)"], ["relaxed", "مريح"]], (v) => set({ density: v as TableStyle["density"] }))}
        {sel("مكان الجدول (المسافة عن بيانات المريض)", ts.gap, [["near", "قريب"], ["normal", "عادي (الأصلي)"], ["far", "بعيد"]], (v) => set({ gap: v as TableStyle["gap"] }))}
        {sel("عرض الجدول", ts.width, [["full", "بعرض الصفحة (الأصلي)"], ["inset", "بهوامش جانبية"]], (v) => set({ width: v as TableStyle["width"] }))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange({ ...ORIGINAL_TABLE })} disabled={isOriginal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas disabled:opacity-50">
          <RotateCcw className="size-4" /> الوضع الافتراضي (الشكل الأصلي)
        </button>
        {isOriginal && <span className="text-xs text-muted">التقرير على شكله الأصلي (ألوانه وجدوله).</span>}
      </div>

    </div>
  );
}
