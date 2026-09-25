"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Lock, WifiOff } from "lucide-react";
import { ACT_KEY, ACTIVATION_SCRIPT } from "@/lib/local/activation";

/**
 * One-time activation window for the local stations (Welcome page and every station).
 * Shown only on a device that is "pending" (new — see ACTIVATION_SCRIPT) while the
 * server has an activation code configured. The code is checked by the server; once
 * accepted the window never appears again on this device. It cannot be dismissed.
 */
const ENABLED_KEY = "local.activation.enabled";
const CONTACT_KEY = "local.activation.contact";
const FAILS_KEY = "local.activation.fails";
const MAX_TRIES = 5, LOCK_MS = 60 * 1000;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function ActivationGate() {
  const [show, setShow] = useState(false);
  const [offline, setOffline] = useState(false);
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lockLeft, setLockLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Normally decided by the pre-paint script; decide here if it could not run.
    if (!read(ACT_KEY)) { try { new Function(ACTIVATION_SCRIPT)(); } catch { /* ignore */ } }
    if (read(ACT_KEY) !== "pending") return;
    setContact(read(CONTACT_KEY) ?? "");
    (async () => {
      try {
        const r = await fetch("/api/activate", { cache: "no-store" });
        const d = (await r.json()) as { enabled: boolean; contact?: string };
        write(ENABLED_KEY, d.enabled ? "1" : "0");
        write(CONTACT_KEY, d.contact ?? "");
        setContact(d.contact ?? "");
        setShow(d.enabled);
      } catch {
        // No connection: ask only if we already know activation is required.
        if (read(ENABLED_KEY) === "1") { setOffline(true); setShow(true); }
      }
    })();
  }, []);

  // Lock-out countdown after too many wrong tries.
  useEffect(() => {
    const tick = () => {
      try {
        const f = JSON.parse(read(FAILS_KEY) ?? "{}") as { until?: number };
        setLockLeft(Math.max(0, Math.ceil(((f.until ?? 0) - Date.now()) / 1000)));
      } catch { setLockLeft(0); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (show) setTimeout(() => inputRef.current?.focus(), 50); }, [show]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy || lockLeft > 0) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/activate", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.trim() }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) {
        write(ACT_KEY, "activated");
        try { localStorage.removeItem(FAILS_KEY); } catch { /* ignore */ }
        setShow(false);
        return;
      }
      if (d.error === "too_many") { setErr("محاولات كثيرة — حاول لاحقاً."); return; }
      const f = JSON.parse(read(FAILS_KEY) ?? "{}") as { n?: number };
      const n = (f.n ?? 0) + 1;
      if (n >= MAX_TRIES) {
        write(FAILS_KEY, JSON.stringify({ n: 0, until: Date.now() + LOCK_MS }));
        setLockLeft(LOCK_MS / 1000);
        setErr(`الرمز غير صحيح. انتظر دقيقة قبل المحاولة التالية.`);
      } else {
        write(FAILS_KEY, JSON.stringify({ n }));
        setErr(`الرمز غير صحيح (${n} من ${MAX_TRIES}).`);
      }
      setCode("");
    } catch {
      setOffline(true);
      setErr("لا يوجد اتصال بالإنترنت — التفعيل يحتاج اتصالاً لمرة واحدة فقط.");
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;
  return (
    <div className="no-print fixed inset-0 z-[90] grid place-items-center bg-slate-900/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تفعيل المحطات">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)]">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-light text-brand-dark"><Lock className="size-6" /></span>
        <div className="mt-3 text-lg font-bold">تفعيل المحطات</div>
        <p className="mb-4 mt-1 text-sm text-muted">أدخل رمز التفعيل لاستعمال المحطات على هذا الجهاز. يُطلب مرة واحدة فقط.</p>
        <input
          ref={inputRef}
          type="password"
          autoComplete="off"
          value={code}
          onChange={(e) => { setCode(e.target.value); setErr(""); }}
          placeholder="رمز التفعيل"
          disabled={lockLeft > 0}
          className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-center text-sm tracking-widest outline-none focus:border-brand disabled:opacity-60 ${err && !offline ? "border-red-400" : "border-line"}`}
        />
        <button disabled={busy || !code.trim() || lockLeft > 0}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          <KeyRound className="size-4" /> {busy ? "جارٍ التحقق…" : "حفظ وتفعيل"}
        </button>
        {lockLeft > 0 && <p className="mt-2 text-xs text-amber-700">يمكنك المحاولة بعد <span dir="ltr">{lockLeft}</span> ثانية.</p>}
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        {offline && !err && <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700"><WifiOff className="size-3.5" /> التفعيل يحتاج اتصالاً بالإنترنت لمرة واحدة.</p>}
        {contact && <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{contact}</p>}
      </form>
    </div>
  );
}
