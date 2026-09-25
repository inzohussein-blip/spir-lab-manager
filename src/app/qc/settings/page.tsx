"use client";

import { ThemeCard } from "@/components/local/LocalTheme";
import { THEME_KEYS } from "@/lib/local/theme";
import { useEffect, useRef, useState } from "react";
import { Settings, Check, Download, Upload, HardDrive } from "lucide-react";
import { getSettings, saveSettings, exportBackup, importBackup, type QcSettings } from "@/lib/qc/store";
import { downloadJson, usageBytes, todayYmd } from "@/lib/local/util";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function QcSettingsPage() {
  const [s, setS] = useState<QcSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [bytes, setBytes] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setS(getSettings()); setBytes(usageBytes("qc.")); }, []);
  if (!s) return null;

  function save() {
    saveSettings({ ...s!, title: s!.title.trim() || "المختبر" });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !window.confirm("سيتم استبدال كل بيانات محطة الجودة بمحتوى الملف. متابعة؟")) return;
    try {
      const ok = importBackup(JSON.parse(await f.text()));
      setMsg(ok ? "تمت الاستعادة بنجاح." : "الملف ليس نسخة احتياطية لمحطة الجودة.");
      if (ok) { setS(getSettings()); setBytes(usageBytes("qc.")); }
    } catch { setMsg("تعذّرت قراءة الملف."); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6 text-brand" /> إعدادات محطة الجودة</h1>

      <ThemeCard storageKey={THEME_KEYS.qc} />
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 text-sm font-semibold">ترويسة التقارير المطبوعة</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم الجهة<input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">العنوان الفرعي<input value={s.subtitle} onChange={(e) => setS({ ...s, subtitle: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium sm:col-span-2">سطر التذييل<input value={s.footer ?? ""} onChange={(e) => setS({ ...s, footer: e.target.value })} className={`mt-1 ${inp}`} /></label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Check className="size-4" /> حفظ</button>
          {saved && <span className="text-xs text-brand-dark">تم الحفظ.</span>}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><HardDrive className="size-4" /> النسخ الاحتياطي</div>
        <p className="mb-3 text-xs text-muted">المساحة المستعملة: <b className="tabular-nums">{Math.max(1, Math.round(bytes / 1024))} KB</b>. صدّر نسخة بانتظام — البيانات محفوظة على هذا الجهاز فقط.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { downloadJson(`qc-backup-${todayYmd()}.json`, exportBackup()); setMsg("تم التصدير."); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Download className="size-4" /> تصدير نسخة احتياطية</button>
          <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Upload className="size-4" /> استعادة من ملف</button>
          <input ref={ref} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        </div>
        {msg && <p className="mt-2 text-xs text-brand-dark">{msg}</p>}
      </div>
    </div>
  );
}
