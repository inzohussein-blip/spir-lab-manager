"use client";

import { SyncPanel } from "@/components/local/SyncPanel";
import { kvFlush } from "@/lib/local/kv";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { LetterheadCard } from "@/components/local/LetterheadCard";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { THEME_KEYS } from "@/lib/local/theme";
import { useEffect, useRef, useState } from "react";
import { Settings, Download, Upload, FileText, HardDrive } from "lucide-react";
import { exportBackup, importBackup, getSettings, saveSettings, type PurchasingSettings } from "@/lib/purchasing/store";

export default function StoreSettingsPage() {
  const [msg, setMsg] = useState("");
  const [s, setS] = useState<PurchasingSettings | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setS(getSettings()); }, []);
  if (!s) return null;

  function doExport() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchasing-backup-${new Date().toLocaleDateString("en-CA")}.json`;
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
        setMsg(ok ? "تم الاستيراد — سيُعاد التحميل." : "ملف غير صالح.");
        if (ok) void kvFlush().then(() => setTimeout(() => location.reload(), 900));
      } catch { setMsg("تعذّرت قراءة الملف."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function saveLetterhead(patch: { title?: string; subtitle?: string; footer?: string; logo?: string }) {
    const cur = getSettings();
    const next: PurchasingSettings = {
      ...cur,
      ...(patch.title !== undefined ? { orgName: patch.title || "منظومة المشتريات" } : {}),
      ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
      ...(patch.footer !== undefined ? { footer: patch.footer } : {}),
      ...(patch.logo !== undefined ? { logo: patch.logo || undefined } : {}),
    };
    saveSettings(next); setS(next); notifySaved();
  }

  return (
    <SettingsLayout
      title="إعدادات المشتريات"
      icon={<Settings className="size-6" />}
      sections={[
        {
          id: "print", label: "المطبوعات", hint: "ترويسة التقرير الشهري والسنوي", icon: <FileText />,
          content: (
            <LetterheadCard heading="ترويسة تقارير المشتريات" nameLabel="اسم الجهة"
              value={{ title: s.orgName ?? "", subtitle: s.subtitle ?? "", footer: s.footer ?? "", logo: s.logo ?? "" }} onSave={saveLetterhead} />
          ),
        },
        {
          id: "device", label: "الجهاز والبيانات", hint: "النسخ الاحتياطي والمظهر", icon: <HardDrive />,
          content: (
            <>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="mb-1 text-sm font-semibold">النسخ الاحتياطي</div>
                <p className="mb-3 text-xs text-muted">كل بيانات المشتريات محفوظة على هذا الحاسوب فقط. صدّر نسخة احتياطية بانتظام أو انقلها لجهاز آخر.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={doExport} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Download className="size-4" /> تصدير نسخة</button>
                  <button onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Upload className="size-4" /> استيراد نسخة</button>
                  <input ref={importRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
                </div>
                {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
              </div>
              <ThemeCard storageKey={THEME_KEYS.store} />
              <PinCard station="purchasing" />
              <SyncPanel />
            </>
          ),
        },
      ]}
    />
  );
}
