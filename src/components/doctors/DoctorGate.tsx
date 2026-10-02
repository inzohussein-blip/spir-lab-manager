"use client";

import { useState, type ReactNode } from "react";
import { Stethoscope, KeyRound, RefreshCw, AlertTriangle } from "lucide-react";
import { labs, addLab, removeLab, useDoctor, FETCH_ERRORS } from "@/lib/doctors/viewer";

/**
 * «نافذة الأطباء» opens only with an activation code: the doctor code the lab made for this
 * doctor in «محطة المزامنة ← رموز الأطباء». Until one is entered (or when every lab stopped its
 * code), only this screen shows — no menu, no other page, no link anywhere.
 */
export function DoctorGate({ children }: { children: ReactNode }) {
  useDoctor();
  const list = labs();
  const active = list.some((l) => l.snap);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (active) return <>{children}</>;
  const stopped = list.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const r = await addLab(code);
    setBusy(false);
    if (!r.ok) { setErr(FETCH_ERRORS[r.error] ?? FETCH_ERRORS.unreachable); return; }
    // The labs whose codes were stopped leave with the new activation.
    for (const l of labs()) if (!l.snap) removeLab(l.id);
    setCode("");
  }
  return (
    <div className="grid min-h-screen flex-1 place-items-center p-4" data-testid="doctor-gate">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)]">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm"><Stethoscope className="size-7" /></span>
        <h1 className="mt-3 text-xl font-bold">نافذة الأطباء</h1>
        {stopped ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-start text-sm text-amber-900 ring-1 ring-amber-200" data-testid="doctor-gate-stopped">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> أوقف المختبر رمزك أو استبدله. اطلب من المختبر رمز التفعيل الجديد.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">أدخل رمز التفعيل الذي أعطاك إياه المختبر لحسابك، فتظهر لك نتائج المراجعين الذين أرسلتهم إليه.</p>
        )}
        <input value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} aria-label="رمز التفعيل" placeholder="XXXX-XXXX-XXXX"
          dir="ltr" autoComplete="off" spellCheck={false} autoFocus
          className={`mt-4 w-full rounded-lg border bg-surface px-3 py-2.5 text-center font-mono text-base uppercase tracking-widest outline-none focus:border-brand ${err ? "border-red-400" : "border-line"}`} />
        <button disabled={busy || code.trim().length < 12} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          {busy ? <RefreshCw className="size-4 animate-spin" /> : <KeyRound className="size-4" />} تفعيل
        </button>
        {err && <p className="mt-2 text-xs text-red-600" role="alert" data-testid="doctor-gate-error">{err}</p>}
        <p className="mt-4 border-t border-line pt-3 text-[11px] text-muted">الرمز يُعطى من المختبر فقط (محطة المزامنة ← رموز الأطباء)، ولكل طبيب رمزه. النتائج تصل مشفّرة وتُفتح على هذا الجهاز وحده.</p>
      </form>
    </div>
  );
}
