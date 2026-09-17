"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Check, Image as ImageIcon, Download, Upload, Trash2 } from "lucide-react";
import {
  getSettings, saveSettings, exportBackup, importBackup, type StationSettings,
} from "@/lib/station/store";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function StationSettingsPage() {
  const [s, setS] = useState<StationSettings>({ labName: "", labSubtitle: "" });
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setS(getSettings()); }, []);

  function save(next?: StationSettings) {
    const v = next ?? s;
    const clean = { ...v, labName: v.labName.trim() || "مختبر", labSubtitle: v.labSubtitle.trim() };
    saveSettings(clean);
    setS(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400 * 1024) { setMsg("حجم الصورة كبير — اختر صورة أصغر من 400KB."); return; }
    const reader = new FileReader();
    reader.onload = () => save({ ...s, logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function doExport() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `station-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ok = importBackup(JSON.parse(String(reader.result)));
        setMsg(ok ? "تم الاستيراد بنجاح — سيُعاد التحميل." : "ملف غير صالح.");
        if (ok) setTimeout(() => location.reload(), 900);
      } catch {
        setMsg("تعذّرت قراءة الملف.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6" /> إعدادات المحطة</h1>

      {/* Report letterhead */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 text-sm font-semibold">ترويسة التقرير المطبوع</div>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">اسم المختبر
            <input value={s.labName} onChange={(e) => setS({ ...s, labName: e.target.value })} className={`mt-1 ${inp}`} />
          </label>
          <label className="text-sm font-medium">العنوان الفرعي
            <input value={s.labSubtitle} onChange={(e) => setS({ ...s, labSubtitle: e.target.value })} className={`mt-1 ${inp}`} />
          </label>

          <div className="text-sm font-medium">شعار المختبر</div>
          <div className="flex items-center gap-3">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo} alt="logo" className="size-14 rounded-lg border border-line object-contain p-1" />
            ) : (
              <span className="grid size-14 place-items-center rounded-lg border border-dashed border-line text-muted">
                <ImageIcon className="size-5" />
              </span>
            )}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
              <Upload className="size-4" /> رفع شعار
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {s.logo && (
              <button onClick={() => save({ ...s, logo: undefined })} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Trash2 className="size-3.5" /> إزالة
              </button>
            )}
          </div>

          <button onClick={() => save()} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Check className="size-4" /> حفظ
          </button>
          {saved && <p className="text-xs text-brand-dark">تم الحفظ.</p>}
        </div>
      </div>

      {/* Backup */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 text-sm font-semibold">النسخ الاحتياطي</div>
        <p className="mb-3 text-xs text-muted">
          كل البيانات محفوظة على هذا الحاسوب فقط. صدّر نسخة احتياطية بانتظام، أو انقلها إلى حاسوب آخر.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={doExport} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Download className="size-4" /> تصدير نسخة احتياطية
          </button>
          <button onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Upload className="size-4" /> استيراد نسخة
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        </div>
        {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}
