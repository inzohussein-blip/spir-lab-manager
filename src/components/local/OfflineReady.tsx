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
const RECHECK_EVERY = 30 * 60 * 1000; // while a page stays open

/** Build id of the code running in this page (from Next's inline data). */
function pageBuild(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = /buildId\\?"\s*:\s*\\?"([^"\\]+)/.exec(s.textContent ?? "");
    if (m) return m[1];
  }
  return null;
}

type State =
  | { kind: "idle" }
  | { kind: "progress"; done: number; total: number }
  | { kind: "installed" }
  | { kind: "updated" }
  | { kind: "refreshed" }
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
      } else if (d.status === "updated") {
        // This page already runs the new version (it came from the server) → just confirm.
        if (d.build && d.build === pageBuild()) {
          setSt({ kind: "refreshed" });
          later(() => setSt((s) => (s.kind === "refreshed" ? { kind: "idle" } : s)), 6000);
        } else setSt({ kind: "updated" });
      } else if (d.status === "error") {
        setSt((s) => (s.kind === "progress" ? { kind: "error" } : s));
        later(() => setSt((s) => (s.kind === "error" ? { kind: "idle" } : s)), 7000);
      } else setSt((s) => (s.kind === "progress" ? { kind: "idle" } : s));
    };
    navigator.serviceWorker.addEventListener("message", onMsg);

    // Look for a newer version: on every page open, every 30 minutes while open, and
    // when the connection comes back. One small request; nothing happens offline.
    let reg: ServiceWorkerRegistration | undefined;
    const check = async () => {
      if (!alive || !navigator.onLine) return;
      try {
        reg?.update().catch(() => {}); // also refresh the worker script itself
        const sw = await activeWorker(reg);
        if (sw && alive) sw.postMessage({ type: "local-prepare" });
      } catch { /* ignore */ }
    };
    (async () => {
      try {
        await Promise.all(SCOPES.map((scope) => navigator.serviceWorker.register("/local-sw.js", { scope })));
        reg = await navigator.serviceWorker.getRegistration(location.pathname);
        await check();
      } catch {
        /* unsupported / private window — the stations still work online */
      }
    })();
    const every = setInterval(check, RECHECK_EVERY);
    window.addEventListener("online", check);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      clearInterval(every);
      window.removeEventListener("online", check);
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
  if (st.kind === "refreshed") {
    return (
      <div className={box} role="status">
        <div className="flex items-center gap-2 font-semibold text-green-700"><CheckCircle2 className="size-4" /> تم تحديث المحطات إلى أحدث نسخة</div>
        <div className="mt-1 text-xs text-muted">وحُدِّثت النسخة المحفوظة للعمل بدون إنترنت أيضاً.</div>
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
