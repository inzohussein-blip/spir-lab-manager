"use client";

import { useEffect, useState } from "react";
import { Settings, Check } from "lucide-react";
import { getSettings, saveSettings, type StationSettings } from "@/lib/station/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function StationSettingsPage() {
  const [s, setS] = useState<StationSettings>({ labName: "", labSubtitle: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => { setS(getSettings()); }, []);

  function save() {
    saveSettings({ labName: s.labName.trim() || "مختبر", labSubtitle: s.labSubtitle.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6" /> إعدادات المحطة</h1>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 text-sm font-semibold">ترويسة التقرير المطبوع</div>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">اسم المختبر
            <input value={s.labName} onChange={(e) => setS({ ...s, labName: e.target.value })} className={`mt-1 ${inp}`} />
          </label>
          <label className="text-sm font-medium">العنوان الفرعي
            <input value={s.labSubtitle} onChange={(e) => setS({ ...s, labSubtitle: e.target.value })} className={`mt-1 ${inp}`} />
          </label>
          <button onClick={save} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Check className="size-4" /> حفظ
          </button>
          {saved && <p className="text-xs text-brand-dark">تم الحفظ.</p>}
        </div>
      </div>
    </div>
  );
}
