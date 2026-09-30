"use client";

import { useState } from "react";
import { Settings, Monitor, Share2, Network, History, Palette } from "lucide-react";
import { clearSyncLog, setDeviceName, syncLog, thisDevice } from "@/lib/local/fileSync";
import { SYNC_EXCLUDE_KEY, SYNC_STATIONS, STATION_SYNC, companySyncOn, syncExcluded } from "@/lib/sync/protocol";
import { CompanySyncCard } from "@/components/local/CompanySyncCard";
import { SyncPanel } from "@/components/local/SyncPanel";
import { ThemeCard } from "@/components/local/LocalTheme";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { THEME_KEYS } from "@/lib/local/theme";
import { card } from "@/components/sync/parts";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** «إعدادات محطة المزامنة»: this computer's name, which stations it shares, its automatic sync,
 *  its sync log and its look. */
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
    setMsg("حُفظ — يسري من المزامنة القادمة."); notifySaved();
  };

  return (
    <SettingsLayout
      title="إعدادات المزامنة"
      icon={<Settings className="size-6" />}
      search
      sections={[
        {
          id: "device", label: "هذا الحاسوب", hint: "اسمه ومعرّفه", icon: <Monitor />,
          content: (
            <section className={card}>
              <label className="text-sm">اسم الحاسوب (يظهر في الحواسيب الأخرى)
                <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { setDeviceName(name); setMsg("حُفظ اسم الحاسوب."); notifySaved(); }} aria-label="اسم الحاسوب" className={`mt-1 ${field}`} />
              </label>
              <div className="mt-2 text-xs text-muted">المعرّف: <span className="font-mono" dir="ltr">{thisDevice().id}</span></div>
            </section>
          ),
        },
        {
          id: "shared", label: "المحطات المشتركة", hint: "ما يُرسل ويُستقبل", icon: <Share2 />,
          badge: excluded.length ? `${excluded.length} على الحاسوب وحده` : undefined,
          content: (
            <section className={card} data-testid="sync-stations">
              <div className="mb-1 font-bold">ما يُشارك مع حواسيب المختبر</div>
              <p className="mb-3 text-xs text-muted">المحطة غير المختارة تبقى على هذا الحاسوب وحده: لا تُرسل بياناتها ولا تُستقبل، لا بالمزامنة التلقائية ولا بملف المزامنة.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SYNC_STATIONS.map(([prefix, label]) => (
                  <label key={prefix} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                    <input type="checkbox" checked={!excluded.includes(prefix)} onChange={(e) => toggle(prefix, e.target.checked)} aria-label={`مشاركة ${label}`} /> {label}
                  </label>
                ))}
              </div>
              {msg && <p className="mt-2 text-xs text-brand-dark" data-testid="sync-settings-msg">{msg}</p>}
            </section>
          ),
        },
        {
          id: "auto", label: "المزامنة التلقائية", hint: "عبر الإنترنت أو الشبكة المحلية", icon: <Network />,
          badge: companySyncOn() ? "مفعّلة" : undefined,
          content: <section className={card}>{STATION_SYNC ? <SyncPanel /> : <CompanySyncCard />}</section>,
        },
        {
          id: "log", label: "السجل", hint: "مسح سجل المزامنة", icon: <History />,
          content: (
            <section className={card}>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">{logSize} عملية مسجّلة</span>
                <button type="button" disabled={!logSize} onClick={() => { if (confirm("مسح سجل المزامنة؟ البيانات لا تتأثر.")) { clearSyncLog(); setLogSize(0); notifySaved(); } }} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas disabled:opacity-50">مسح السجل</button>
              </div>
            </section>
          ),
        },
        {
          id: "look", label: "المظهر", hint: "فاتح أو داكن", icon: <Palette />,
          content: <ThemeCard storageKey={THEME_KEYS.sync} />,
        },
      ]}
    />
  );
}
