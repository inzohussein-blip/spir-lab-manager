"use client";

import { useRef, useState } from "react";
import { Settings, Download, Upload } from "lucide-react";
import { exportBackup, importBackup } from "@/lib/purchasing/store";

export default function StoreSettingsPage() {
  const [msg, setMsg] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  function doExport() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchasing-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
        if (ok) setTimeout(() => location.reload(), 900);
      } catch { setMsg("تعذّرت قراءة الملف."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6" /> الإعدادات والنسخ الاحتياطي</h1>
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
    </div>
  );
}
