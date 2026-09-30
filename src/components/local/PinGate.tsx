"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, KeyRound, RefreshCw, LockKeyhole, ShieldCheck } from "lucide-react";
import { usePin, tryPin, setPin, lockNow, cleanPin, validPin, type PinStation } from "@/lib/local/pin";
import { refreshLicense } from "@/lib/license/client";
import { notifySaved } from "@/components/SettingsLayout";

/** Covers the station until its PIN is typed (nothing shows while no PIN is set). */
export function PinGate({ station, title }: { station: PinStation; title: string }) {
  const { ready, locked } = usePin(station);
  const [pin, setPinText] = useState("");
  const [err, setErr] = useState(false);
  const [help, setHelp] = useState<"" | "open" | "busy" | "same">("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (locked) setTimeout(() => ref.current?.focus(), 50); }, [locked]);
  if (!ready || !locked) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = tryPin(station, pin);
    setErr(!ok);
    setPinText("");
  }
  async function fromProvider() {
    setHelp("busy");
    await refreshLicense(true, 0);
    setHelp("same"); // still locked: no change yet, or a new PIN to type above
  }
  return (
    <div className="no-print fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-canvas p-4" role="dialog" aria-modal="true" aria-label="رمز الدخول" data-testid="pin-gate">
      <form onSubmit={submit} className="w-full max-w-xs rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)]">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-light text-brand-dark"><Lock className="size-6" /></span>
        <div className="mt-3 text-lg font-bold">{title}</div>
        <p className="mb-4 mt-1 text-sm text-muted">أدخل رمز الدخول للمتابعة.</p>
        <input ref={ref} type="password" inputMode="numeric" autoComplete="off" dir="ltr" value={pin} aria-label="رمز الدخول"
          onChange={(e) => { setPinText(cleanPin(e.target.value)); setErr(false); }} placeholder="••••"
          className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-center text-lg tracking-[0.4em] outline-none focus:border-brand ${err ? "border-red-400" : "border-line"}`} />
        <button disabled={pin.length < 4} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          <KeyRound className="size-4" /> دخول
        </button>
        {err && <p className="mt-2 text-xs text-red-600">رمز غير صحيح</p>}
        <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
          {help === "" ? (
            <button type="button" onClick={() => setHelp("open")} className="font-semibold text-brand-dark hover:underline">نسيت الرمز؟</button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p>اطلب من المزوّد تعيين رمز جديد (أو إزالته) من صفحة الرموز، ثم اضغط «تحديث» والجهاز متصل بالإنترنت.</p>
              <button type="button" onClick={fromProvider} disabled={help === "busy"} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 font-semibold text-ink hover:bg-canvas disabled:opacity-60">
                <RefreshCw className={`size-3.5 ${help === "busy" ? "animate-spin" : ""}`} /> تحديث من المزوّد
              </button>
              {help === "same" && <p className="text-amber-700">تم التحديث. إذا عيّن المزوّد رمزاً جديداً فأدخله أعلاه، وإلا فلا تغيير بعد.</p>}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm tracking-[0.3em] outline-none focus:border-brand";

/** Settings card: switch the station's PIN on, change it, lock now, or switch it off. */
export function PinCard({ station }: { station: PinStation }) {
  const { ready, on } = usePin(station);
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  if (!ready) return null;

  function save() {
    if (!validPin(a)) { setErr("الرمز من 4 إلى 8 أرقام."); return; }
    if (a !== b) { setErr("الرمزان غير متطابقين."); return; }
    setPin(station, a);
    setA(""); setB(""); setErr(""); setEditing(false);
    notifySaved();
  }
  function off() {
    if (!window.confirm("إيقاف رمز الدخول لهذه المحطة؟")) return;
    setPin(station, null);
    notifySaved();
  }
  return (
    <div data-testid="pin-card" className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <LockKeyhole className="size-4" /> رمز الدخول (PIN)
        {on && <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand-dark"><ShieldCheck className="size-3" /> مفعّل</span>}
      </div>
      <p className="mb-3 text-xs text-muted">
        يُطلب عند فتح هذه المحطة على هذا الجهاز (مرة لكل نافذة). إذا نُسي، يعيّنه المزوّد أو يزيله من صفحة الرموز ثم «نسيت الرمز؟ ← تحديث من المزوّد» في شاشة الدخول.
      </p>
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input type="password" inputMode="numeric" autoComplete="new-password" dir="ltr" value={a} onChange={(e) => { setA(cleanPin(e.target.value)); setErr(""); }} placeholder="الرمز الجديد" aria-label="الرمز الجديد" className={inp} />
          <input type="password" inputMode="numeric" autoComplete="new-password" dir="ltr" value={b} onChange={(e) => { setB(cleanPin(e.target.value)); setErr(""); }} placeholder="تأكيد الرمز" aria-label="تأكيد الرمز" className={inp} />
          <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">حفظ الرمز</button>
          <button onClick={() => { setEditing(false); setA(""); setB(""); setErr(""); }} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">إلغاء</button>
          {err && <p className="text-xs text-red-600 sm:col-span-4">{err}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <KeyRound className="size-4" /> {on ? "تغيير الرمز" : "تفعيل رمز الدخول"}
          </button>
          {on && (
            <>
              <button onClick={() => lockNow(station)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Lock className="size-4" /> قفل الآن</button>
              <button onClick={off} className="rounded-lg border border-line px-3 py-2 text-sm text-red-600 hover:bg-red-50">إيقاف الرمز</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
