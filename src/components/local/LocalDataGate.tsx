"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { kvReady, KV_ERROR_EVENT } from "@/lib/local/kv";

/** Shows a station once its data is loaded from the browser's storage (see lib/local/kv). */
export function LocalDataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    kvReady().finally(() => { if (alive) setReady(true); });
    const onErr = () => setFailed(true);
    window.addEventListener(KV_ERROR_EVENT, onErr);
    return () => { alive = false; window.removeEventListener(KV_ERROR_EVENT, onErr); };
  }, []);
  if (!ready) return <div className="grid min-h-[50vh] flex-1 place-items-center text-sm text-muted" aria-busy="true">جارٍ تحميل البيانات…</div>;
  return (
    <>
      {children}
      {failed && (
        <div role="alert" className="no-print fixed inset-x-0 top-0 z-[95] flex justify-center p-3">
          <div className="flex max-w-2xl items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-[var(--shadow-pop)]">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">تعذّر حفظ آخر تعديل على هذا الجهاز (مساحة القرص ممتلئة أو المتصفح منع الحفظ). نزّل نسخة احتياطية الآن من الإعدادات.</span>
            <button onClick={() => setFailed(false)} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">إخفاء</button>
          </div>
        </div>
      )}
    </>
  );
}
