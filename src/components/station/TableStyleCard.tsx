"use client";

import { useEffect, useMemo, useState } from "react";
import { Table2, RotateCcw } from "lucide-react";
import { getTests, type StationSettings, type StationTest } from "@/lib/station/store";
import { tableStyleOf, ORIGINAL_TABLE, type TableStyle } from "@/lib/station/tableStyle";
import { ResultsTable, type ReportRow } from "./ReportSheet";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** Settings card: look of the printed results table, with a live preview. */
export function TableStyleCard({ settings, onChange }: { settings: StationSettings; onChange: (t: TableStyle) => void }) {
  const ts = tableStyleOf(settings.reportTable);
  const set = (patch: Partial<TableStyle>) => onChange({ ...ts, ...patch });
  const isOriginal = JSON.stringify(ts) === JSON.stringify(ORIGINAL_TABLE);

  // Preview rows taken from the catalog (English names, real reference ranges).
  const [tests, setTests] = useState<StationTest[]>([]);
  useEffect(() => setTests(getTests()), []);
  const groups = useMemo(() => {
    const byCode = (c: string) => tests.find((t) => t.code === c);
    const row = (code: string, value: string): ReportRow | null => {
      const t = byCode(code);
      return t ? { key: t.id, name: t.name_ar, value, unit: t.unit, test: t } : null;
    };
    const g = (cat: string, rows: (ReportRow | null)[]) => ({ cat, rows: rows.filter(Boolean) as ReportRow[] });
    return [
      g("Hematology", [row("HB", "11.2"), row("WBC", "7.4"), row("PLT", "250")]),
      g("Renal Function Tests", [row("UREA", "52"), row("CREA", "0.9")]),
    ].filter((x) => x.rows.length);
  }, [tests]);

  const sel = (label: string, value: string, options: [string, string][], on: (v: string) => void) => (
    <label className="text-xs text-muted">{label}
      <select value={value} onChange={(e) => on(e.target.value)} className={`mt-1 ${inp}`}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Table2 className="size-4" /> جدول النتائج المطبوع</div>
      <p className="mb-4 text-xs text-muted">تظهر التعديلات فوراً في المعاينة أدناه وفي ورقة النتائج (A4 وA5).</p>

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
        {isOriginal && <span className="text-xs text-muted">الجدول على شكله الأصلي.</span>}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-4 text-black">
        <div className="mb-1 text-[11px] text-gray-500">معاينة</div>
        <ResultsTable ts={{ ...ts, gap: "near" }} groups={groups} gender="male" age="40" />
      </div>
    </div>
  );
}
