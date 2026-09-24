"use client";

import { useEffect, useState } from "react";
import { CloudOff, CheckCircle2, RefreshCw, X } from "lucide-react";

/**
 * Makes the local stations work without internet (see /public/local-sw.js):
 * the first online visit saves the whole app on this computer; later visits open
 * from it. When online it also fetches newer versions in the background and offers
 * a reload. The admin panel is not involved — it keeps its own worker.
 */
const SCOPES = ["/welcome", "/station", "/store", "/training", "/qc", "/roster"];
const CHECK_KEY = "local-offline-check";
const CHECK_EVERY = 10 * 60 * 1000;

type State =
  | { kind: "idle" }
  | { kind: "progress"; done: number; total: number }
  | { kind: "installed" }
  | { kind: "updated" }
  | { kind: "error" };

function activeWorker(reg?: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  if (!reg) return Promise.resolve(null);
  if (reg.active) return Promise.resolve(reg.active);
  const sw = reg.installing ?? reg.waiting;
  if (!sw) return Promise.resolve(null);
  return new Promise((resolve) => {
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") resolve(sw);
      if (sw.state === "redundant") resolve(null);
    });
  });
}

export function OfflineReady() {
  const [st, setSt] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));

    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!alive || !d || d.type !== "local-offline") return;
      if (d.status === "progress") setSt({ kind: "progress", done: d.done, total: d.total });
      else if (d.status === "installed") {
        setSt({ kind: "installed" });
        try { localStorage.setItem("local-offline-ready", String(Date.now())); } catch { /* ignore */ }
        later(() => setSt((s) => (s.kind === "installed" ? { kind: "idle" } : s)), 6000);
      } else if (d.status === "updated") setSt({ kind: "updated" });
      else if (d.status === "error") {
        try { sessionStorage.removeItem(CHECK_KEY); } catch { /* ignore */ } // retry on the next page load
        setSt((s) => (s.kind === "progress" ? { kind: "error" } : s));
        later(() => setSt((s) => (s.kind === "error" ? { kind: "idle" } : s)), 7000);
      } else setSt((s) => (s.kind === "progress" ? { kind: "idle" } : s));
    };
    navigator.serviceWorker.addEventListener("message", onMsg);

    (async () => {
      try {
        await Promise.all(SCOPES.map((scope) => navigator.serviceWorker.register("/local-sw.js", { scope })));
        const sw = await activeWorker(await navigator.serviceWorker.getRegistration(location.pathname));
        if (!sw || !alive) return;
        // One small request at most every 10 minutes per tab to look for updates.
        const last = Number(sessionStorage.getItem(CHECK_KEY) || 0);
        if (Date.now() - last < CHECK_EVERY) return;
        sessionStorage.setItem(CHECK_KEY, String(Date.now()));
        sw.postMessage({ type: "local-prepare" });
      } catch {
        /* unsupported / private window — the stations still work online */
      }
    })();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      navigator.serviceWorker.removeEventListener("message", onMsg);
    };
  }, []);

  if (st.kind === "idle") return null;
  const box = "no-print fixed bottom-4 left-4 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 text-sm shadow-[var(--shadow-pop)]";

  if (st.kind === "progress") {
    const pct = Math.round((st.done / st.total) * 100);
    return (
      <div className={box} role="status">
        <div className="flex items-center gap-2 font-semibold"><CloudOff className="size-4 text-brand" /> جارٍ تجهيز العمل بدون إنترنت…</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1 text-xs text-muted">مرة واحدة فقط — <span dir="ltr">{st.done} / {st.total}</span></div>
      </div>
    );
  }
  if (st.kind === "installed") {
    return (
      <div className={box} role="status">
        <div className="flex items-center gap-2 font-semibold text-green-700"><CheckCircle2 className="size-4" /> جاهز للعمل بدون إنترنت</div>
        <div className="mt-1 text-xs text-muted">حُفظت كل المحطات على هذا الجهاز، وستفتح من الآن بدون إنترنت.</div>
      </div>
    );
  }
  if (st.kind === "error") {
    return (
      <div className={box} role="status">
        <div className="font-semibold text-amber-700">لم يكتمل التجهيز للعمل بدون إنترنت</div>
        <div className="mt-1 text-xs text-muted">ستُعاد المحاولة تلقائياً عند فتح المحطة مع الإنترنت.</div>
      </div>
    );
  }
  return (
    <div className={box} role="status">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold"><RefreshCw className="size-4 text-brand" /> يوجد تحديث جديد للمحطات</div>
        <button onClick={() => setSt({ kind: "idle" })} aria-label="لاحقاً" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-canvas"><X className="size-4" /></button>
      </div>
      <div className="mt-1 text-xs text-muted">تم تنزيله على الجهاز. احفظ عملك ثم أعد التحميل لتطبيقه، أو سيُطبَّق تلقائياً في المرة القادمة.</div>
      <button onClick={() => location.reload()} className="mt-3 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">إعادة التحميل الآن</button>
    </div>
  );
}

/** One-line status for a settings page: is this computer ready to work offline? */
export function OfflineStatusLine() {
  const [at, setAt] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      try {
        const r = await (await caches.open("local-meta")).match("/__local-meta");
        const m = r ? await r.json() : null;
        setAt(m && (await caches.has(m.cache)) ? m.at : null);
      } catch { setAt(null); }
    })();
  }, []);
  if (at === undefined) return null;
  return at ? (
    <p className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 className="size-3.5" /> المحطات جاهزة للعمل بدون إنترنت على هذا الجهاز (آخر تحديث: <span dir="ltr">{new Date(at).toLocaleDateString("en-CA")}</span>)</p>
  ) : (
    <p className="text-xs text-amber-700">لم تُجهَّز المحطات للعمل بدون إنترنت بعد — تُجهَّز تلقائياً عند فتحها مع الإنترنت.</p>
  );
}
