"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { kvReady, KV_ERROR_EVENT, KV_REMOTE_EVENT } from "@/lib/local/kv";
import { STATION_SYNC, companySyncOn } from "@/lib/sync/protocol";

/** Shows a station once its data is loaded from the browser's storage (see lib/local/kv), and —
 *  only when station sync is switched on (STATION_SYNC) — starts the sync with the lab's database. */
export function LocalDataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [arrived, setArrived] = useState(0);
  const [view, setView] = useState(0);
  const [needsJoin, setNeedsJoin] = useState(false);
  useEffect(() => {
    let alive = true;
    let offSync = () => {};
    kvReady().finally(() => {
      if (!alive) return;
      setReady(true);
      // When each record changed here, for «محطة المزامنة» (syncing the lab's computers).
      void import("@/lib/local/fileSync").then((m) => m.startSyncClock()).catch(() => {});
      // The lab's automatic sync (switched on per computer in «محطة المزامنة»), or the build's.
      if (!STATION_SYNC && !companySyncOn()) return;
      import("@/lib/sync/client").then((m) => {
        if (!alive) return;
        const upd = () => setNeedsJoin(m.syncStatus().state === "needs_join");
        window.addEventListener(m.SYNC_EVENT, upd);
        offSync = () => window.removeEventListener(m.SYNC_EVENT, upd);
        upd();
        void m.startSync();
      }).catch(() => { /* offline copy without the sync chunk: the station works as before */ });
    });
    const onErr = () => setFailed(true);
    const onRemote = (e: Event) => setArrived((n) => n + (Number((e as CustomEvent).detail) || 1));
    window.addEventListener(KV_ERROR_EVENT, onErr);
    window.addEventListener(KV_REMOTE_EVENT, onRemote);
    return () => { alive = false; offSync(); window.removeEventListener(KV_ERROR_EVENT, onErr); window.removeEventListener(KV_REMOTE_EVENT, onRemote); };
  }, []);
  if (!ready) return <div className="grid min-h-[50vh] flex-1 place-items-center text-sm text-muted" aria-busy="true">جارٍ تحميل البيانات…</div>;
  const settings = `/${(typeof location !== "undefined" ? location.pathname : "/station").split("/")[1] || "station"}/settings#lab-db`;
  return (
    <>
      <Fragment key={view}>{children}</Fragment>
      {failed && (
        <div role="alert" className="no-print fixed inset-x-0 top-0 z-[95] flex justify-center p-3">
          <div className="flex max-w-2xl items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-[var(--shadow-pop)]">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">تعذّر حفظ آخر تعديل على هذا الجهاز (مساحة القرص ممتلئة أو المتصفح منع الحفظ). نزّل نسخة احتياطية الآن من الإعدادات.</span>
            <button onClick={() => setFailed(false)} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">إخفاء</button>
          </div>
        </div>
      )}
      {arrived > 0 && (
        <div role="status" data-testid="sync-arrived" className="no-print fixed bottom-4 right-4 z-[80] flex max-w-sm items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]">
          <RefreshCw className="size-4 shrink-0 text-brand" />
          <span className="flex-1">وصلت تحديثات من أجهزة المختبر الأخرى</span>
          <button onClick={() => { setArrived(0); setView((v) => v + 1); }} className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">عرضها</button>
        </div>
      )}
      {needsJoin && !location.pathname.endsWith("/settings") && (
        <div role="status" data-testid="sync-needs-join" className="no-print fixed bottom-4 left-4 z-[80] flex max-w-sm items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-[var(--shadow-pop)]">
          <Database className="size-4 shrink-0" />
          <span className="flex-1">قاعدة بيانات المختبر جاهزة — اختر كيف يُربط هذا الجهاز بها.</span>
          <a href={settings} className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700">الإعدادات</a>
        </div>
      )}
    </>
  );
}
