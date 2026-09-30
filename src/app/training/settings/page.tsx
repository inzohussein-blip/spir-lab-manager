"use client";

import { SyncPanel } from "@/components/local/SyncPanel";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { THEME_KEYS } from "@/lib/local/theme";
import { LockGate } from "@/components/training/LockGate";
import { useEffect, useRef, useState } from "react";
import { Settings, ShieldCheck, Download, Upload, HardDrive, FileText, Loader2, Lock, Library } from "lucide-react";
import { setLock, useEditLock } from "@/lib/training/lock";
import { getSettings, saveSettings, exportBackup, importBackup, textUsage, getTests, addMissingLibrary, type TrainingSettings } from "@/lib/training/store";
import { LIBRARY_CODES } from "@/lib/training/library";
import { ImagePicker } from "@/components/training/ImagePicker";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

/** Letterhead of the printed procedures and the general safety lines — each saves as it changes. */
function PrintCards() {
  const [s, setS] = useState<TrainingSettings | null>(null);
  useEffect(() => { setS(getSettings()); }, []);
  if (!s) return null;
  const save = (patch: Partial<TrainingSettings>) => {
    const next = { ...getSettings(), ...patch };
    next.title = next.title.trim() || "المختبر";
    saveSettings(next); setS(next); notifySaved();
  };
  const text = (k: "title" | "subtitle" | "footer" | "preparedBy", label: string, wide = false) => (
    <label className={`text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>{label}
      <input value={s[k] ?? ""} onChange={(e) => setS({ ...s, [k]: e.target.value })} onBlur={(e) => save({ [k]: e.target.value.trim() })} className={`mt-1 ${inp}`} />
    </label>
  );
  return (
    <>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4" /> ترويسة البروسيجر المطبوع (SOP)</div>
        <p className="mb-3 text-xs text-muted">يُحفظ كل حقل عند الخروج منه.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("title", "اسم الجهة")}
          {text("subtitle", "العنوان الفرعي")}
          {text("footer", "سطر التذييل", true)}
          {text("preparedBy", "أعدّه (يظهر في خانة التوقيع)")}
          <label className="text-sm font-medium">مدة المراجعة الافتراضية (بالأشهر)
            <input type="number" min={1} max={60} value={s.reviewMonths ?? 12} onChange={(e) => setS({ ...s, reviewMonths: Math.max(1, Number(e.target.value) || 12) })} onBlur={() => save({ reviewMonths: s.reviewMonths })} className={`mt-1 ${inp}`} />
          </label>
          <div className="text-sm font-medium">الشعار<div className="mt-1"><ImagePicker value={s.logoImageId} onChange={(v) => save({ logoImageId: v })} label="شعار" size="size-14" /></div></div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-green-600" /> تعليمات السلامة والجودة العامة</div>
        <p className="mb-2 text-xs text-muted">تُطبع في كل بروسيجر لا يحتوي على تعليمات خاصة به. كل سطر = بند.</p>
        <textarea rows={6} value={s.defaultSafety} onChange={(e) => setS({ ...s, defaultSafety: e.target.value })} onBlur={(e) => save({ defaultSafety: e.target.value })} aria-label="تعليمات السلامة والجودة العامة" className={inp} />
      </div>
    </>
  );
}

/** Storage use and the backup file (with the images). */
function BackupCard() {
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
  // Once, when the page opens (refreshUsage only reads the browser's storage).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshUsage(); }, []);

  async function doExport() {
    setBusy(true);
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `training-backup-${new Date().toLocaleDateString("en-CA")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000); // let the download start first
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
      if (ok) refreshUsage();
    } catch {
      setMsg("تعذّرت قراءة الملف.");
    } finally { setBusy(false); }
  }

  return (
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
  );
}

/** «مكتبة الفحوصات»: every test of the lab station's list comes with the station; deleted ones can be
 *  brought back (edited ones are never replaced). */
function LibraryCard() {
  const [count, setCount] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { setCount(getTests().length); }, []);
  function restore() {
    const n = addMissingLibrary();
    setCount(getTests().length);
    setMsg(n ? `أُضيف ${n} فحص من المكتبة.` : "كل فحوصات المكتبة موجودة.");
    if (n) notifySaved();
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]" data-testid="library-card">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Library className="size-4" /> مكتبة الفحوصات</div>
      <p className="mb-3 text-xs text-muted">
        تأتي المحطة بكل فحوصات محطة المختبر ({LIBRARY_CODES().length} فحصاً، مع صورة الدم الكاملة) مشروحة: الغرض والطريقة والعينة والتحضير والخطوات
        والملاحظات والقيم الطبيعية وأسباب الارتفاع والانخفاض. في المحطة الآن: <b className="tabular-nums">{count ?? "…"}</b> فحص.
      </p>
      <button onClick={restore} data-testid="library-restore" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
        <Library className="size-4" /> إضافة فحوصات المكتبة الناقصة
      </button>
      <p className="mt-1 text-[11px] text-muted">يُضيف ما حُذف فقط، ولا يغيّر فحصاً موجوداً أو عدّلته.</p>
      {msg && <p className="mt-2 text-xs text-brand-dark" role="status">{msg}</p>}
    </div>
  );
}

export default function TrainingSettingsPage() {
  // Appearance is a personal choice, so it stays available in read-only mode;
  // everything else on this page needs the edit PIN.
  return (
    <SettingsLayout
      title="إعدادات محطة التدريب"
      icon={<Settings className="size-6 text-brand" />}
      sections={[
        {
          id: "print", label: "المطبوعات", hint: "ترويسة البروسيجر وتعليمات السلامة", icon: <FileText />,
          content: <LockGate><div className="flex flex-col gap-4"><PrintCards /></div></LockGate>,
        },
        {
          id: "device", label: "الجهاز والبيانات", hint: "النسخ الاحتياطي والقفل والمزامنة", icon: <HardDrive />,
          content: (
            <>
              <LockGate><div className="flex flex-col gap-4"><LibraryCard /><BackupCard /><LockCard /><SyncPanel /></div></LockGate>
            </>
          ),
        },
        {
          id: "look", label: "الأمان والمظهر", hint: "رمز الدخول والألوان", icon: <ShieldCheck />,
          content: (
            <>
              <PinCard station="training" />
              <ThemeCard storageKey={THEME_KEYS.training} />
            </>
          ),
        },
      ]}
    />
  );
}

/** Optional read-only mode (off by default): editing requires a PIN. */
function LockCard() {
  const { lockOn } = useEditLock();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState("");

  async function enable() {
    if (!/^\d{4,8}$/.test(pin)) { setMsg("الرمز من 4 إلى 8 أرقام."); return; }
    if (pin !== pin2) { setMsg("الرمزان غير متطابقين."); return; }
    await setLock(true, pin);
    setPin(""); setPin2(""); setOpen(false);
    setMsg(lockOn ? "تم تغيير الرمز." : "تم تفعيل وضع القراءة فقط.");
  }
  async function disable() {
    if (!window.confirm("إيقاف وضع القراءة فقط؟ سيتمكن أي شخص من التعديل.")) return;
    await setLock(false);
    setMsg("تم الإيقاف.");
  }

  const pinInp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-brand";
  return (
    <div className={`mb-4 rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)] ${lockOn ? "border-brand/40" : "border-line"}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Lock className="size-4" /> وضع القراءة فقط للمتدربين (اختياري)</div>
      <p className="mb-3 text-xs text-muted">
        عند تفعيله يستطيع الجميع القراءة والاختبار والطباعة، أما الإضافة والتعديل والحذف والإعدادات وسجل المتدربين فتحتاج رمزاً. يبقى الفتح فعّالاً حتى إغلاق نافذة المتصفح أو الضغط على «قفل».
      </p>
      <div className="mb-3 flex items-center gap-2 text-sm">
        الحالة:
        {lockOn
          ? <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark">مفعّل</span>
          : <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted">غير مفعّل</span>}
      </div>
      {open ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="الرمز الجديد" className={pinInp} />
          <input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value)} placeholder="تأكيد الرمز" className={pinInp} />
          <div className="flex gap-2">
            <button onClick={enable} className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">حفظ</button>
            <button onClick={() => { setOpen(false); setMsg(""); }} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">إلغاء</button>
          </div>
          <p className="text-xs text-amber-700 sm:col-span-3">احفظ الرمز جيداً — لا يمكن استرجاعه، ونسيانه يمنع الوصول إلى الإعدادات والتعديل.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setOpen(true); setMsg(""); }} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">{lockOn ? "تغيير الرمز" : "تفعيل وتعيين رمز"}</button>
          {lockOn && <button onClick={disable} className="rounded-lg border border-line px-3 py-2 text-sm text-red-600 hover:bg-red-50">إيقاف</button>}
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-brand-dark">{msg}</p>}
    </div>
  );
}
