"use client";

import { useState } from "react";
import { Settings, Monitor, Share2, Network, History, ShieldCheck, Power } from "lucide-react";
import { clearSyncLog, setDeviceName, syncLog, thisDevice } from "@/lib/local/fileSync";
import { SYNC_EXCLUDE_KEY, SYNC_STATIONS, STATION_SYNC, companySyncOn, syncExcluded, syncMasterOn, setSyncMaster } from "@/lib/sync/protocol";
import { CompanySyncCard } from "@/components/local/CompanySyncCard";
import { SyncPanel } from "@/components/local/SyncPanel";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { THEME_KEYS } from "@/lib/local/theme";
import { card } from "@/components/sync/parts";
import { STATION_META } from "@/components/sync/ui";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** «إعدادات محطة المزامنة»: this computer's name, which stations it shares, its automatic sync,
 *  its sync log and its look. */
export default function SyncSettings() {
  // Rendered once the station data is loaded (LocalDataGate), so it is read right away.
  const [name, setName] = useState(() => thisDevice().name);
  const [excluded, setExcluded] = useState<string[]>(syncExcluded);
  const [logSize, setLogSize] = useState(() => syncLog().length);
  const [msg, setMsg] = useState("");
  const [master, setMaster] = useState(syncMasterOn);
  function switchMaster(on: boolean) {
    if (!on && !window.confirm("إيقاف المزامنة على هذا الحاسوب؟ لا يُرسل شيء ولا يُستقبل (تلقائياً أو بملف) حتى تشغيلها. البيانات تبقى كما هي.")) return;
    setSyncMaster(on); setMaster(on); notifySaved();
    void import("@/lib/sync/client").then((m) => m.syncNow());
  }
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
          id: "protect", label: "الحماية", hint: "تشغيل المزامنة أو إيقافها", icon: <Power />,
          badge: master ? undefined : "موقوفة",
          content: (
            <section className={card} data-testid="sync-master">
              <div className="mb-1 font-bold">المزامنة على هذا الحاسوب</div>
              <p className="mb-3 text-xs text-muted">إيقافها يمنع إرسال أو استقبال أي بيانات من هذا الحاسوب — المزامنة التلقائية وملف المزامنة معاً — حتى تشغيلها من جديد. مفيد عند الشك أو عند إعارة الحاسوب. التعديلات أثناء الإيقاف تُرسل بعد التشغيل.</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${master ? "bg-teal-50 text-brand-dark" : "bg-amber-100 text-amber-800"}`} data-testid="sync-master-state">{master ? "تعمل" : "موقوفة"}</span>
                <button type="button" onClick={() => switchMaster(!master)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${master ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-brand text-white hover:bg-brand-dark"}`}>
                  {master ? "إيقاف المزامنة" : "تشغيل المزامنة"}
                </button>
              </div>
            </section>
          ),
        },
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
                {SYNC_STATIONS.map(([prefix, label]) => {
                  const m = STATION_META[prefix.slice(0, -1)];
                  const Icon = m?.icon;
                  const on = !excluded.includes(prefix);
                  return (
                    <label key={prefix} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${on ? "border-brand/40 bg-brand-light/40" : "border-line bg-canvas"}`}>
                      {Icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: m.color, opacity: on ? 1 : 0.45 }}><Icon className="size-4" /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block">{label}</span>
                        <span className="block text-[11px] text-muted">{on ? "تُشارك مع حواسيب المختبر" : "على هذا الحاسوب وحده"}</span>
                      </span>
                      <input type="checkbox" checked={on} onChange={(e) => toggle(prefix, e.target.checked)} aria-label={`مشاركة ${label}`} className="size-4 accent-[var(--color-brand)]" />
                    </label>
                  );
                })}
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
          id: "look", label: "الأمان والمظهر", hint: "رمز الدخول والألوان", icon: <ShieldCheck />,
          content: (
            <>
              <PinCard station="sync" />
              <ThemeCard storageKey={THEME_KEYS.sync} />
            </>
          ),
        },
      ]}
    />
  );
}
