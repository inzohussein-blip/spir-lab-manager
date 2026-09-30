"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Settings, Monitor, Share2, History } from "lucide-react";
import { clearSyncLog, setDeviceName, syncLog, thisDevice } from "@/lib/local/fileSync";
import { SYNC_EXCLUDE_KEY, SYNC_STATIONS, STATION_SYNC, syncExcluded } from "@/lib/sync/protocol";
import { CompanySyncCard } from "@/components/local/CompanySyncCard";

const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";
const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** «إعدادات محطة المزامنة»: this computer's name, its automatic sync, which stations it shares,
 *  and its sync log. */
export default function SyncSettings() {
  // Rendered once the station data is loaded (LocalDataGate), so it is read right away.
  const [name, setName] = useState(() => thisDevice().name);
  const [excluded, setExcluded] = useState<string[]>(syncExcluded);
  const [logSize, setLogSize] = useState(() => syncLog().length);
  const [msg, setMsg] = useState("");
  const toggle = (prefix: string, shared: boolean) => {
    const next = shared ? excluded.filter((x) => x !== prefix) : [...new Set([...excluded, prefix])];
    setExcluded(next);
    try { localStorage.setItem(SYNC_EXCLUDE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setMsg("حُفظ — يسري من المزامنة القادمة.");
  };
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/sync" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="size-4" /> محطة المزامنة</Link>
        <h1 className="flex flex-1 items-center gap-2 text-xl font-bold"><Settings className="size-5 text-brand" /> إعدادات محطة المزامنة</h1>
      </div>

      <section className={card}>
        <div className="mb-3 flex items-center gap-2 font-bold"><Monitor className="size-4 text-brand" /> هذا الحاسوب</div>
        <label className="text-sm">اسم الحاسوب (يظهر في الحواسيب الأخرى)
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { setDeviceName(name); setMsg("حُفظ اسم الحاسوب."); }} aria-label="اسم الحاسوب" className={`mt-1 ${field}`} />
        </label>
        <div className="mt-2 text-xs text-muted">المعرّف: <span className="font-mono" dir="ltr">{thisDevice().id}</span></div>
      </section>

      <section className={card} data-testid="sync-stations">
        <div className="mb-1 flex items-center gap-2 font-bold"><Share2 className="size-4 text-brand" /> ما يُشارك مع حواسيب المختبر</div>
        <p className="mb-3 text-xs text-muted">المحطة غير المختارة تبقى على هذا الحاسوب وحده: لا تُرسل بياناتها ولا تُستقبل، لا بالمزامنة التلقائية ولا بملف المزامنة.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SYNC_STATIONS.map(([prefix, label]) => (
            <label key={prefix} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
              <input type="checkbox" checked={!excluded.includes(prefix)} onChange={(e) => toggle(prefix, e.target.checked)} aria-label={`مشاركة ${label}`} /> {label}
            </label>
          ))}
        </div>
      </section>

      {!STATION_SYNC && (
        <section className={card}>
          <div className="mb-2 font-bold">المزامنة التلقائية</div>
          <CompanySyncCard />
        </section>
      )}

      <section className={card}>
        <div className="mb-2 flex items-center gap-2 font-bold"><History className="size-4 text-brand" /> سجل المزامنة</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{logSize} عملية مسجّلة</span>
          <button type="button" disabled={!logSize} onClick={() => { if (confirm("مسح سجل المزامنة؟ البيانات لا تتأثر.")) { clearSyncLog(); setLogSize(0); setMsg("مُسح السجل."); } }} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas disabled:opacity-50">مسح السجل</button>
        </div>
      </section>
      {msg && <p className="text-xs text-brand-dark" data-testid="sync-settings-msg">{msg}</p>}
    </div>
  );
}
