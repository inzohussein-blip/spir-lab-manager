"use client";

import { SyncPanel } from "@/components/local/SyncPanel";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { THEME_KEYS } from "@/lib/local/theme";
import { useEffect, useRef, useState } from "react";
import { Settings, Download, Upload, HardDrive, FileText, Clock } from "lucide-react";
import { LetterheadCard } from "@/components/local/LetterheadCard";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { getSettings, saveSettings, exportBackup, importBackup, type RosterSettings } from "@/lib/roster/store";
import { downloadJson, usageBytes, todayYmd, AR_DAYS } from "@/lib/local/util";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function RosterSettingsPage() {
  const [s, setS] = useState<RosterSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [bytes, setBytes] = useState(0);
  const [rev, setRev] = useState(0); // a restored backup refreshes the letterhead fields
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setS(getSettings()); setBytes(usageBytes("roster.")); }, []);
  if (!s) return null;

  /** Every change saves at once (text fields when you leave them). */
  function save(patch: Partial<RosterSettings>) {
    const next = { ...getSettings(), ...patch };
    next.title = next.title.trim() || "المختبر";
    next.graceMin = Math.max(0, Number(next.graceMin) || 0);
    next.annualLeaveDays = Math.max(0, Number(next.annualLeaveDays) || 0);
    saveSettings(next); setS(next); notifySaved();
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !window.confirm("سيتم استبدال كل بيانات محطة الكادر بمحتوى الملف. متابعة؟")) return;
    try {
      const ok = importBackup(JSON.parse(await f.text()));
      setMsg(ok ? "تمت الاستعادة بنجاح." : "الملف ليس نسخة احتياطية لمحطة الكادر.");
      if (ok) { setS(getSettings()); setBytes(usageBytes("roster.")); setRev((r) => r + 1); }
    } catch { setMsg("تعذّرت قراءة الملف."); }
  }

  return (
    <SettingsLayout
      title="إعدادات محطة الكادر"
      icon={<Settings className="size-6 text-brand" />}
      sections={[
        {
          id: "print", label: "المطبوعات", hint: "ترويسة الجداول وكشوف الحضور والرواتب", icon: <FileText />,
          content: (
            <LetterheadCard key={rev} heading="ترويسة مطبوعات الكادر"
              value={{ title: s.title, subtitle: s.subtitle, footer: s.footer ?? "", logo: s.logo ?? "" }}
              onSave={(p) => save({ ...p, ...(p.logo !== undefined ? { logo: p.logo || undefined } : {}) })} />
          ),
        },
        {
          id: "rules", label: "قواعد الدوام", hint: "التأخير والإجازات وبداية الأسبوع", icon: <Clock />,
          content: (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" /> قواعد الدوام</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">سماحية التأخير (دقيقة)<input type="number" min={0} value={s.graceMin} onChange={(e) => setS({ ...s, graceMin: Number(e.target.value) })} onBlur={() => save({ graceMin: s.graceMin })} className={`mt-1 ${inp}`} /></label>
                <label className="text-sm font-medium">رصيد الإجازة السنوية (يوم)<input type="number" min={0} value={s.annualLeaveDays} onChange={(e) => setS({ ...s, annualLeaveDays: Number(e.target.value) })} onBlur={() => save({ annualLeaveDays: s.annualLeaveDays })} className={`mt-1 ${inp}`} /></label>
                <label className="text-sm font-medium">بداية الأسبوع<select value={s.weekStart} onChange={(e) => save({ weekStart: Number(e.target.value) })} className={`mt-1 ${inp}`}>{AR_DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
              </div>
            </div>
          ),
        },
        {
          id: "device", label: "الجهاز والبيانات", hint: "النسخ الاحتياطي والمظهر", icon: <HardDrive />,
          content: (
            <>
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
              <ThemeCard storageKey={THEME_KEYS.roster} />
              <PinCard station="roster" />
              <SyncPanel />
            </>
          ),
        },
      ]}
    />
  );
}
