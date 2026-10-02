"use client";

import { useRef, useState } from "react";
import { Settings, Monitor, KeyRound, Globe2, Building2, MessageSquareText, ShieldCheck, Trash2, Plus, RefreshCw, HardDrive, Download, Upload } from "lucide-react";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { THEME_KEYS } from "@/lib/local/theme";
import { getSettings, saveSettings, setRoomCode, renewIdentity, myFingerprint, useConnect, DEFAULT_QUICK, exportBackup, importBackup } from "@/lib/connect/store";
import { downloadJson, todayYmd } from "@/lib/local/util";
import { useNet } from "@/lib/connect/net";
import { CodeForm } from "@/components/connect/CodeForm";
import { card } from "@/components/connect/Thread";
import { cn } from "@/lib/utils";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

function Toggle({ on, onChange, label, hint, disabled, testid }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: string; testid?: string }) {
  return (
    <label className={cn("flex items-start gap-3 rounded-xl border border-line p-3 text-sm", disabled && "opacity-60")} data-testid={testid}>
      <input type="checkbox" checked={on} disabled={!!disabled} onChange={(e) => { onChange(e.target.checked); notifySaved(); }} aria-label={label} className="mt-1 size-4 accent-[var(--color-brand)]" />
      <span><b>{label}</b><span className="mt-0.5 block text-xs text-muted">{disabled || hint}</span></span>
    </label>
  );
}

/** «إعدادات محطة التواصل». Every change saves at once (text fields when you leave them). */
export default function ConnectSettings() {
  useConnect();
  const net = useNet();
  const s = getSettings();
  const [name, setName] = useState(s.name);
  const [labName, setLabName] = useState(s.labName);
  const [alias, setAlias] = useState(s.alias);
  const [quick, setQuick] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !window.confirm("استبدال بيانات محطة التواصل على هذا الحاسوب (المفتاح والمختبرات والرسائل) بمحتوى الملف؟")) return;
    try { setBackupMsg(importBackup(JSON.parse(await f.text())) ? "تمت الاستعادة." : "الملف ليس نسخة احتياطية لمحطة التواصل."); } catch { setBackupMsg("تعذّرت قراءة الملف."); }
  }
  const save = (p: Parameters<typeof saveSettings>[0]) => { saveSettings(p); notifySaved(); };
  const relay = !!net.info?.licensing && !!net.info.relay;

  return (
    <SettingsLayout
      title="إعدادات محطة التواصل"
      icon={<Settings className="size-6" />}
      sections={[
        {
          id: "device", label: "هذا الحاسوب", hint: "الاسم في المحادثات والبطاقة", icon: <Monitor />,
          content: (
            <section className={card}>
              <label className="block text-sm">اسم هذا الحاسوب في المحادثة الداخلية
                <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => save({ name: name.trim().slice(0, 40) })} aria-label="اسم الحاسوب في المحادثة" placeholder="مثلاً: الاستقبال" className={`mt-1 ${inp}`} />
              </label>
              <label className="mt-3 block text-sm">اسم المختبر على «بطاقة التعارف»
                <input value={labName} onChange={(e) => setLabName(e.target.value)} onBlur={() => save({ labName: labName.trim().slice(0, 60) })} aria-label="اسم المختبر على البطاقة" placeholder="مثلاً: مختبر الشفاء" className={`mt-1 ${inp}`} />
              </label>
            </section>
          ),
        },
        {
          id: "room", label: "المحادثة الداخلية", hint: "رمز المحادثة (غير رمز المزامنة)", icon: <KeyRound />,
          badge: s.room ? "مضبوط" : undefined,
          content: (
            <section className={card}>
              <div className="mb-2 font-bold">رمز المحادثة</div>
              {s.room && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" data-testid="room-code-set">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-brand-dark">مضبوط على هذا الحاسوب</span>
                  <button onClick={() => { if (window.confirm("إزالة رمز المحادثة من هذا الحاسوب؟ لا يرى بعدها المحادثة الداخلية.")) { setRoomCode(null); notifySaved(); } }} className="rounded-lg border border-line px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">إزالة الرمز</button>
                </div>
              )}
              <CodeForm compact />
            </section>
          ),
        },
        {
          id: "public", label: "المحادثة العامة", hint: "الاسم الظاهر للمختبرات", icon: <Globe2 />,
          content: (
            <section className={card}>
              <div className="mb-2 text-sm font-semibold">أظهر في المحادثة العامة باسم</div>
              <div className="mb-3 flex gap-2">
                {(["alias", "lab"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={s.publicAs === k} onClick={() => save({ publicAs: k })}
                    className={cn("rounded-full border px-3 py-1.5 text-xs", s.publicAs === k ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line hover:bg-canvas")}>
                    {k === "alias" ? "اسم مستعار" : "اسم المختبر (من رمزه)"}
                  </button>
                ))}
              </div>
              <label className="block text-sm">الاسم المستعار
                <input value={alias} onChange={(e) => setAlias(e.target.value.slice(0, 40))} onBlur={() => save({ alias: alias.trim() })} aria-label="الاسم المستعار" className={`mt-1 ${inp}`} />
              </label>
              <p className="mt-2 text-xs text-muted">لا تظهر أي معلومة أخرى عن مختبرك. اسم المختبر يُؤخذ من رمزه (لا يمكن انتحاله)، والاسم المستعار يُعلَّم بأنه مستعار.</p>
            </section>
          ),
        },
        {
          id: "labs", label: "المختبرات", hint: "صندوق البريد والاتصال المباشر والمفاتيح", icon: <Building2 />,
          content: (
            <section className={cn(card, "flex flex-col gap-3")}>
              <Toggle on={s.mailbox && relay} onChange={(v) => save({ mailbox: v })} testid="mailbox-toggle"
                label="صندوق البريد المشفّر لدى المزوّد"
                hint="تصل رسائلك للمختبرات وهي غير متصلة، عبر خادم المزوّد. الرسالة مشفّرة لذلك المختبر فقط، والخادم لا يقرأها، وتُحذف عنده بعد استلامها."
                disabled={relay ? undefined : "غير متاح: المزوّد لم يفعّله (أو هذا ليس موقع المزوّد)."} />
              <Toggle on={s.stun} onChange={(v) => save({ stun: v })} testid="stun-toggle"
                label="المساعدة في إيجاد الطريق للاتصال المباشر (STUN)"
                hint="يلزم للاتصال المباشر مع مختبر آخر عبر الإنترنت. خادم STUN عام يخبر الحاسوب بعنوانه فقط ولا يرى أي رسالة. مطفأ: داخل شبكة المختبر فقط." />
              <div className="rounded-xl border border-line p-3 text-sm">
                <div className="font-semibold">مفتاح هذا الحاسوب</div>
                <div className="mt-1 text-xs text-muted">البصمة: <span className="font-mono tracking-wider" dir="ltr">{myFingerprint()}</span></div>
                <button onClick={() => { if (window.confirm("مفتاح جديد؟ لن تستطيع المختبرات مراسلتك حتى تضيف بطاقتك الجديدة.")) { renewIdentity(); notifySaved(); } }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas"><RefreshCw className="size-3.5" /> مفتاح جديد</button>
              </div>
            </section>
          ),
        },
        {
          id: "messages", label: "الرسائل", hint: "الحفظ والتنبيه والرسائل الجاهزة", icon: <MessageSquareText />,
          content: (
            <section className={cn(card, "flex flex-col gap-3")}>
              <label className="block text-sm">مدة حفظ الرسائل على هذا الحاسوب
                <select value={s.retentionDays} onChange={(e) => save({ retentionDays: Number(e.target.value) })} aria-label="مدة حفظ الرسائل" className={`mt-1 ${inp}`}>
                  {[[7, "أسبوع"], [30, "شهر"], [90, "3 أشهر"], [365, "سنة"], [0, "دائماً"]].map(([d, l]) => <option key={d} value={d}>{l}</option>)}
                </select>
              </label>
              <Toggle on={s.sound} onChange={(v) => save({ sound: v })} label="تنبيه صوتي عند وصول رسالة" hint="صوت قصير ما دامت المحطة مفتوحة." testid="sound-toggle" />
              <div>
                <div className="mb-1 text-sm font-semibold">الرسائل الجاهزة</div>
                <ul className="mb-2 flex flex-wrap gap-1.5" data-testid="quick-list">
                  {s.quick.map((q) => (
                    <li key={q} className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-1 text-xs">
                      {q} <button onClick={() => save({ quick: s.quick.filter((x) => x !== q) })} aria-label={`حذف ${q}`} className="text-red-700"><Trash2 className="size-3" /></button>
                    </li>
                  ))}
                </ul>
                <form onSubmit={(e) => { e.preventDefault(); const v = quick.trim().slice(0, 60); if (v && !s.quick.includes(v)) save({ quick: [...s.quick, v] }); setQuick(""); }} className="flex gap-2">
                  <input value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="رسالة جاهزة جديدة" placeholder="رسالة جاهزة جديدة" className={inp} />
                  <button className="inline-flex items-center gap-1 rounded-lg border border-line px-3 text-sm hover:bg-canvas"><Plus className="size-4" /> إضافة</button>
                </form>
                <button onClick={() => save({ quick: DEFAULT_QUICK })} className="mt-2 text-xs text-brand-dark hover:underline">استعادة الرسائل الافتراضية</button>
              </div>
            </section>
          ),
        },
        {
          id: "device-data", label: "الجهاز والبيانات", hint: "النسخ الاحتياطي", icon: <HardDrive />,
          content: (
            <section className={card} data-testid="connect-backup">
              <div className="mb-1 font-bold">النسخ الاحتياطي</div>
              <p className="mb-3 text-xs text-muted">مفتاح هذا الحاسوب والمختبرات المعروفة والرسائل والإعدادات في ملف واحد. فيه مفتاحك الخاص: احفظه في مكان آمن ولا ترسله لأحد. باستعادته على حاسوب جديد تبقى المختبرات تعرفه دون بطاقة جديدة.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { downloadJson(`connect-backup-${todayYmd()}.json`, exportBackup()); setBackupMsg("تم التصدير."); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Download className="size-4" /> تصدير نسخة احتياطية</button>
                <button onClick={() => file.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Upload className="size-4" /> استعادة من ملف</button>
                <input ref={file} type="file" accept="application/json,.json" onChange={restore} className="hidden" data-testid="connect-backup-file" />
              </div>
              {backupMsg && <p className="mt-2 text-xs text-brand-dark" data-testid="connect-backup-msg">{backupMsg}</p>}
            </section>
          ),
        },
        {
          id: "look", label: "الأمان والمظهر", hint: "رمز الدخول والألوان", icon: <ShieldCheck />,
          content: (
            <>
              <PinCard station="connect" />
              <ThemeCard storageKey={THEME_KEYS.connect} />
            </>
          ),
        },
      ]}
    />
  );
}
