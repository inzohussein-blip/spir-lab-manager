"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Lock, WifiOff, Clock, ArrowRight, RefreshCw, X } from "lucide-react";
import {
  evaluate, fetchEnabled, refreshLicense, activateCode, cachedContact, WARN_DAYS, type LicenseState,
} from "@/lib/license/client";
import { moduleLabel, type LicenseModule } from "@/lib/license/modules";

/**
 * Lab-code gate for the Welcome page and every local station («منظومة الرموز»).
 *  - no code on a new device → activation window (cannot be dismissed);
 *  - code expired / stopped / clock turned back / 30-day transition over → full lock;
 *  - the station is not in this lab's code → that station is locked;
 *  - ending within 14 days, or a device still on the old activation → a small notice.
 * Does nothing while lab codes are switched off on the server.
 */
const DAY = 86_400_000;
const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "");
const HIDE_KEY = "local.license.noticeHidden";

// One server round per page load, shared by every gate / card on the page.
let boot: Promise<void> | null = null;

export function useLicense(module?: LicenseModule) {
  const [state, setState] = useState<LicenseState | null>(null);
  const run = useCallback(async () => setState(await evaluate(module)), [module]);
  useEffect(() => {
    let alive = true;
    (async () => {
      await run();                      // offline answer first (cached "enabled" + stored license)
      boot ??= (async () => { await fetchEnabled(); await refreshLicense(); })();
      await boot;
      if (alive) await run();
    })();
    return () => { alive = false; };
  }, [run]);
  return { state, recheck: run };
}

const ERR: Record<string, string> = {
  not_found: "الرمز غير صحيح.",
  other_device: "هذا الرمز مفعّل على جهاز آخر — تواصل مع المزوّد لنقله.",
  stopped: "هذا الرمز موقوف — تواصل مع المزوّد.",
  expired: "انتهت مدة هذا الرمز — تواصل مع المزوّد للتجديد.",
  too_many: "محاولات كثيرة — حاول بعد قليل.",
  offline: "لا يوجد اتصال بالإنترنت — التفعيل يحتاج اتصالاً.",
  bad_request: "اكتب الرمز كاملاً كما وصلك.",
  disabled: "منظومة الرموز غير مفعّلة حالياً.",
};

function CodeForm({ onDone, cta = "تفعيل" }: { onDone: () => void; cta?: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true); setErr("");
    const r = await activateCode(code.trim());
    setBusy(false);
    if (r.ok) { setCode(""); onDone(); } else setErr(ERR[r.error] ?? "تعذّر التفعيل — حاول مرة أخرى.");
  }
  return (
    <form onSubmit={submit}>
      <input ref={ref} value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }}
        autoComplete="off" spellCheck={false} dir="ltr" placeholder="XXXX-XXXX-XXXX" aria-label="رمز المختبر"
        className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-center font-mono text-base tracking-widest outline-none focus:border-brand ${err ? "border-red-400" : "border-line"}`} />
      <button disabled={busy || !code.trim()}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        <KeyRound className="size-4" /> {busy ? "جارٍ التحقق…" : cta}
      </button>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </form>
  );
}

function Screen({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const contact = cachedContact();
  return (
    <div className="no-print fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-900/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)]">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-light text-brand-dark">{icon}</span>
        <div className="mt-3 text-lg font-bold">{title}</div>
        {children}
        {contact && <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{contact}</p>}
      </div>
    </div>
  );
}

export function ActivationGate({ module }: { module?: LicenseModule }) {
  const { state, recheck } = useLicense(module);
  const [openForm, setOpenForm] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [checking, setChecking] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem(HIDE_KEY) === new Date().toLocaleDateString("en-CA")); } catch { setHidden(false); } }, []);
  const hideToday = () => { try { localStorage.setItem(HIDE_KEY, new Date().toLocaleDateString("en-CA")); } catch { /* ignore */ } setHidden(true); };
  const done = () => { setOpenForm(false); recheck(); };
  async function checkNow() { setChecking(true); await fetchEnabled(); await refreshLicense(true); await recheck(); setChecking(false); }

  if (!state || state.kind === "off") return null;

  if (state.kind === "need") return (
    <Screen icon={<Lock className="size-6" />} title="تفعيل المحطات">
      <p className="mb-4 mt-1 text-sm text-muted">أدخل رمز مختبرك لتفعيل المحطات على هذا الجهاز. يُطلب مرة واحدة ويحتاج اتصالاً بالإنترنت.</p>
      <CodeForm onDone={done} />
      {!navigator.onLine && <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700"><WifiOff className="size-3.5" /> لا يوجد اتصال بالإنترنت الآن.</p>}
    </Screen>
  );

  if (state.kind === "locked") {
    const msg = {
      expired: `انتهت مدة رمز «${state.lab}» بتاريخ ${fmt(state.until)}.`,
      stopped: `رمز «${state.lab}» موقوف.`,
      gone: "رمز هذا الجهاز لم يعد صالحاً (نُقل لجهاز آخر أو حُذف).",
      grace_over: "انتهت فترة التفعيل السابق على هذا الجهاز (30 يوماً).",
      clock: "تاريخ الجهاز أو ساعته غير صحيحة — صحّحها ثم اضغط «تحقق الآن».",
    }[state.reason];
    return (
      <Screen icon={state.reason === "clock" ? <Clock className="size-6" /> : <Lock className="size-6" />} title="المحطات مقفلة">
        <p className="mb-1 mt-1 text-sm text-muted">{msg}</p>
        <p className="mb-4 text-xs text-muted">بيانات المختبر محفوظة على هذا الجهاز وتعود كاملة بعد التجديد.</p>
        {state.reason !== "clock" && <CodeForm onDone={done} cta="تفعيل رمز جديد" />}
        <button onClick={checkNow} disabled={checking} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas disabled:opacity-60">
          <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} /> تحقق الآن (بعد التمديد)
        </button>
      </Screen>
    );
  }

  if (state.kind === "module_off") return (
    <Screen icon={<Lock className="size-6" />} title="المحطة غير مفعّلة">
      <p className="mb-4 mt-1 text-sm text-muted">«{moduleLabel(state.module)}» غير مفعّلة في رمز {state.lab ? `«${state.lab}»` : "هذا الجهاز"}. تواصل مع المزوّد لإضافتها.</p>
      <a href="/welcome" className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        <ArrowRight className="size-4" /> الرجوع للصفحة الرئيسية
      </a>
      <button onClick={checkNow} disabled={checking} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas disabled:opacity-60">
        <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} /> تحقق الآن
      </button>
    </Screen>
  );

  // Small notices (the stations stay usable).
  const left = state.kind === "grace" || state.kind === "ok" ? Math.ceil((state.until - Date.now()) / DAY) : 0;
  const notice =
    state.kind === "grace" ? `هذا الجهاز يعمل بالتفعيل السابق حتى ${fmt(state.until)} (${left} يوم) — أدخل رمز مختبرك قبل ذلك.`
    : state.kind === "ok" && left <= WARN_DAYS ? `ينتهي رمز «${state.lab}» خلال ${left} يوم (${fmt(state.until)}) — تواصل مع المزوّد للتجديد.`
    : "";
  return (
    <>
      {notice && !hidden && !openForm && (
        <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3">
          <div className="pointer-events-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-[var(--shadow-pop)]">
            <Clock className="size-4 shrink-0" />
            <span className="flex-1">{notice}</span>
            {state.kind === "grace" && (
              <button onClick={() => setOpenForm(true)} className="rounded-md bg-amber-600 px-2 py-1 font-semibold text-white hover:bg-amber-700">إدخال الرمز</button>
            )}
            <button onClick={hideToday} aria-label="إخفاء اليوم" title="إخفاء اليوم" className="grid size-6 place-items-center rounded-md hover:bg-amber-100"><X className="size-3.5" /></button>
          </div>
        </div>
      )}
      {openForm && (
        <Screen icon={<KeyRound className="size-6" />} title="رمز المختبر">
          <p className="mb-4 mt-1 text-sm text-muted">أدخل الرمز الذي وصلك لمختبرك.</p>
          <CodeForm onDone={done} />
          <button onClick={() => setOpenForm(false)} className="mt-2 w-full rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">لاحقاً</button>
        </Screen>
      )}
    </>
  );
}
