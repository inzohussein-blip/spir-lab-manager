"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Check, ShieldCheck, Download, Upload, HardDrive, FileText, Loader2 } from "lucide-react";
import { getSettings, saveSettings, exportBackup, importBackup, textUsage, type TrainingSettings } from "@/lib/training/store";
import { ImagePicker } from "@/components/training/ImagePicker";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

export default function TrainingSettingsPage() {
  const [s, setS] = useState<TrainingSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{ text: number; used?: number; quota?: number; persisted?: boolean }>({ text: 0 });
  const importRef = useRef<HTMLInputElement>(null);

  async function refreshUsage() {
    const u: typeof usage = { text: textUsage() };
    try {
      const est = await navigator.storage?.estimate?.();
      u.used = est?.usage; u.quota = est?.quota;
      u.persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.());
    } catch { /* unsupported */ }
    setUsage(u);
  }
  useEffect(() => { setS(getSettings()); refreshUsage(); }, []);

  if (!s) return null;

  function save() {
    saveSettings({ ...s!, title: s!.title.trim() || "المختبر" });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function doExport() {
    setBusy(true);
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(`تم تصدير ${data.tests.length} فحص و ${data.images.length} صورة.`);
    } finally { setBusy(false); }
  }
  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!window.confirm("سيتم استبدال كل بيانات محطة التدريب (الفحوصات والتيوبات والأدوات والصور) بمحتوى الملف. متابعة؟")) return;
    setBusy(true);
    try {
      const ok = await importBackup(JSON.parse(await f.text()));
      setMsg(ok ? "تمت الاستعادة بنجاح." : "الملف ليس نسخة احتياطية لمحطة التدريب.");
      if (ok) { setS(getSettings()); refreshUsage(); }
    } catch {
      setMsg("تعذّرت قراءة الملف.");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6 text-brand" /> إعدادات محطة التدريب</h1>

      {/* Letterhead */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4" /> ترويسة البروسيجر المطبوع (SOP)</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">اسم الجهة<input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">العنوان الفرعي<input value={s.subtitle} onChange={(e) => setS({ ...s, subtitle: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium sm:col-span-2">سطر التذييل<input value={s.footer ?? ""} onChange={(e) => setS({ ...s, footer: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">أعدّه (يظهر في خانة التوقيع)<input value={s.preparedBy ?? ""} onChange={(e) => setS({ ...s, preparedBy: e.target.value })} className={`mt-1 ${inp}`} /></label>
          <label className="text-sm font-medium">مدة المراجعة الافتراضية (بالأشهر)
            <input type="number" min={1} max={60} value={s.reviewMonths ?? 12} onChange={(e) => setS({ ...s, reviewMonths: Math.max(1, Number(e.target.value) || 12) })} className={`mt-1 ${inp}`} />
          </label>
          <div className="text-sm font-medium">الشعار<div className="mt-1"><ImagePicker value={s.logoImageId} onChange={(v) => setS({ ...s, logoImageId: v })} label="شعار" size="size-14" /></div></div>
        </div>
      </div>

      {/* Default safety */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-green-600" /> تعليمات السلامة والجودة العامة</div>
        <p className="mb-2 text-xs text-muted">تُطبع في كل بروسيجر لا يحتوي على تعليمات خاصة به. كل سطر = بند.</p>
        <textarea rows={6} value={s.defaultSafety} onChange={(e) => setS({ ...s, defaultSafety: e.target.value })} className={inp} />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Check className="size-4" /> حفظ الإعدادات</button>
        {saved && <span className="text-xs text-brand-dark">تم الحفظ.</span>}
      </div>

      {/* Storage + backup */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><HardDrive className="size-4" /> التخزين والنسخ الاحتياطي</div>
        <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-canvas px-3 py-2">النصوص: <b className="tabular-nums">{Math.max(1, Math.round(usage.text / 1024))} KB</b></div>
          {usage.used != null && usage.quota != null && (
            <div className="rounded-lg bg-canvas px-3 py-2">المساحة المستعملة مع الصور: <b className="tabular-nums" dir="ltr">{mb(usage.used)} / {mb(usage.quota)}</b></div>
          )}
          {usage.persisted != null && (
            <div className={`rounded-lg px-3 py-2 sm:col-span-2 ${usage.persisted ? "bg-brand-light text-brand-dark" : "bg-amber-50 text-amber-800"}`}>
              {usage.persisted ? "✓ الحفظ الدائم مفعّل — لن يحذف المتصفح البيانات تلقائياً." : "الحفظ الدائم غير مفعّل — صدّر نسخة احتياطية بانتظام."}
            </div>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">ملف النسخة يتضمّن كل الفحوصات والتيوبات والأدوات والإعدادات <b>والصور</b> — يمكن نقله إلى حاسوب آخر.</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={doExport} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} تصدير نسخة احتياطية
          </button>
          <button disabled={busy} onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Upload className="size-4" /> استعادة من ملف
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={doImport} className="hidden" />
        </div>
        {msg && <p className="mt-2 text-xs text-brand-dark">{msg}</p>}
      </div>
    </div>
  );
}
