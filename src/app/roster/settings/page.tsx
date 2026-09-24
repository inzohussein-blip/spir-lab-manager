"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Check, Download, Upload, HardDrive } from "lucide-react";
import { getSettings, saveSettings, exportBackup, importBackup, type RosterSettings } from "@/lib/roster/store";
import { downloadJson, usageBytes, todayYmd, AR_DAYS } from "@/lib/local/util";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function RosterSettingsPage() {
  const [s, setS] = useState<RosterSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [bytes, setBytes] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setS(getSettings()); setBytes(usageBytes("roster.")); }, []);
  if (!s) return null;

  function save() {
    saveSettings({ ...s!, title: s!.title.trim() || "المختبر", graceMin: Math.max(0, Number(s!.graceMin) || 0), annualLeaveDays: Math.max(0, Number(s!.annualLeaveDays) || 0) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !window.confirm("سيتم استبدال كل بيانات محطة الكادر بمحتوى الملف. متابعة؟")) return;
    try {
      const ok = importBackup(JSON.parse(await f.text()));
      setMsg(ok ? "تمت الاستعادة بنجاح." : "الملف ليس نسخة احتياطية لمحطة الكادر.");
      if (ok) { setS(getSettings()); setBytes(usageBytes("roster.")); }
    } catch { setMsg("تعذّرت قراءة الملف."); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6 text-brand" /> إعدادات محطة الكادر</h1>
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم الجهة<input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">العنوان الفرعي<input value={s.subtitle} onChange={(e) => setS({ ...s, subtitle: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium sm:col-span-2">سطر التذييل<input value={s.footer ?? ""} onChange={(e) => setS({ ...s, footer: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">سماحية التأخير (دقيقة)<input type="number" min={0} value={s.graceMin} onChange={(e) => setS({ ...s, graceMin: Number(e.target.value) })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">رصيد الإجازة السنوية (يوم)<input type="number" min={0} value={s.annualLeaveDays} onChange={(e) => setS({ ...s, annualLeaveDays: Number(e.target.value) })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">بداية الأسبوع<select value={s.weekStart} onChange={(e) => setS({ ...s, weekStart: Number(e.target.value) })} className={`mt-1 ${inp}`}>{AR_DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Check className="size-4" /> حفظ</button>
          {saved && <span className="text-xs text-brand-dark">تم الحفظ.</span>}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><HardDrive className="size-4" /> النسخ الاحتياطي</div>
        <p className="mb-3 text-xs text-muted">المساحة المستعملة: <b className="tabular-nums">{Math.max(1, Math.round(bytes / 1024))} KB</b>. البيانات محفوظة على هذا الجهاز فقط.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { downloadJson(`roster-backup-${todayYmd()}.json`, exportBackup()); setMsg("تم التصدير."); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Download className="size-4" /> تصدير نسخة احتياطية</button>
          <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Upload className="size-4" /> استعادة من ملف</button>
          <input ref={ref} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        </div>
        {msg && <p className="mt-2 text-xs text-brand-dark">{msg}</p>}
      </div>
    </div>
  );
}
