"use client";

import { useState, type ReactNode } from "react";
import { Lock, KeyRound } from "lucide-react";
import { tryUnlock, useEditLock } from "@/lib/training/lock";

/** PIN prompt used by pages/actions that need edit rights in read-only mode. */
export function UnlockForm({ compact = false }: { compact?: boolean }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await tryUnlock(pin);
    setErr(!ok);
    if (!ok) setPin("");
  }
  return (
    <form onSubmit={submit} className={compact ? "flex flex-wrap items-center gap-2" : "mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]"}>
      {!compact && (
        <>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-light text-brand-dark"><Lock className="size-6" /></span>
          <div className="mt-3 text-lg font-bold">وضع القراءة فقط</div>
          <p className="mb-4 mt-1 text-sm text-muted">هذه الصفحة للتعديل — أدخل رمز التعديل للمتابعة.</p>
        </>
      )}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => { setPin(e.target.value); setErr(false); }}
        placeholder="رمز التعديل"
        className={`rounded-lg border bg-surface px-3 py-2 text-center text-sm tracking-widest outline-none focus:border-brand ${err ? "border-red-400" : "border-line"} ${compact ? "w-32" : "w-full"}`}
      />
      <button className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark ${compact ? "" : "mt-3 w-full"}`}>
        <KeyRound className="size-4" /> فتح
      </button>
      {err && <p className={`text-xs text-red-600 ${compact ? "" : "mt-2"}`}>رمز غير صحيح</p>}
    </form>
  );
}

/** Renders children only when editing is allowed; otherwise a PIN prompt. */
export function LockGate({ children }: { children: ReactNode }) {
  const { ready, canEdit } = useEditLock();
  if (!ready) return null;
  return canEdit ? <>{children}</> : <UnlockForm />;
}
