"use client";

import { SyncPanel } from "@/components/local/SyncPanel";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { THEME_KEYS } from "@/lib/local/theme";
import { useEffect, useRef, useState } from "react";
import { Settings, Download, Upload, HardDrive, FileText } from "lucide-react";
import { LetterheadCard } from "@/components/local/LetterheadCard";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { getSettings, saveSettings, exportBackup, importBackup, type QcSettings } from "@/lib/qc/store";
import { downloadJson, usageBytes, todayYmd } from "@/lib/local/util";


export default function QcSettingsPage() {
  const [s, setS] = useState<QcSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [bytes, setBytes] = useState(0);
  const [rev, setRev] = useState(0); // a restored backup refreshes the letterhead fields
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setS(getSettings()); setBytes(usageBytes("qc.")); }, []);
  if (!s) return null;

  /** Every change saves at once (text fields when you leave them). */
  function save(patch: Partial<QcSettings>) {
    const next = { ...getSettings(), ...patch };
    next.title = next.title.trim() || "المختبر";
    saveSettings(next); setS(next); notifySaved();
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !window.confirm("سيتم استبدال كل بيانات محطة الجودة بمحتوى الملف. متابعة؟")) return;
    try {
      const ok = importBackup(JSON.parse(await f.text()));
      setMsg(ok ? "تمت الاستعادة بنجاح." : "الملف ليس نسخة احتياطية لمحطة الجودة.");
      if (ok) { setS(getSettings()); setBytes(usageBytes("qc.")); setRev((r) => r + 1); }
    } catch { setMsg("تعذّرت قراءة الملف."); }
  }

  return (
    <SettingsLayout
      title="إعدادات محطة الجودة"
      icon={<Settings className="size-6 text-brand" />}
      sections={[
        {
          id: "print", label: "المطبوعات", hint: "ترويسة سجلات الحرارة والأجهزة والمخططات", icon: <FileText />,
          content: (
            <LetterheadCard key={rev} heading="ترويسة التقارير المطبوعة"
              value={{ title: s.title, subtitle: s.subtitle, footer: s.footer ?? "", logo: s.logo ?? "" }}
              onSave={(p) => save({ ...p, ...(p.logo !== undefined ? { logo: p.logo || undefined } : {}) })} />
          ),
        },
        {
          id: "device", label: "الجهاز والبيانات", hint: "النسخ الاحتياطي والمظهر", icon: <HardDrive />,
          content: (
            <>
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
              <ThemeCard storageKey={THEME_KEYS.qc} />
              <PinCard station="qc" />
              <SyncPanel />
            </>
          ),
        },
      ]}
    />
  );
}
