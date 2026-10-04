"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, RefreshCw, Eye, Ban, Copy } from "lucide-react";
import { createDoctorCode, revokeDoctorCode, refreshDoctorCodes, showDoctorCode } from "@/app/actions/desk";
import { WINDOW_LABEL, type DoctorWindow } from "@/lib/doctors/code";

interface Row { id: string; name: string; done: number; codeId: string | null; win: string; hidePhone: boolean; lastAt: string | null; lastError: string | null }
const ERR: Record<string, string> = { off: "نافذة الأطباء موقوفة من مزوّد الخدمة", too_many_codes: "بلغ المختبر أقصى عدد للرموز", too_big: "النتائج كثيرة — اختر مدة أقصر", taken: "تعارض في الرمز — أنشئ رمزاً جديداً" };

export function DoctorCodes({ rows, on }: { rows: Row[]; on: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [shown, setShown] = useState<{ name: string; code: string } | null>(null);
  const [opts, setOpts] = useState<Record<string, { win: string; hide: boolean }>>({});
  const opt = (r: Row) => opts[r.id] ?? { win: r.win, hide: r.hidePhone };
  return (
    <div className="flex flex-col gap-3" data-testid="doctor-codes">
      {!on && <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-200">نافذة الأطباء موقوفة الآن من مزوّد الخدمة — تُحفظ الرموز وتُرفع النتائج عند تشغيلها.</div>}
      {shown && (
        <div className="rounded-xl border border-teal-300 bg-teal-50 p-4" data-testid="doctor-code-shown">
          <div className="text-sm">رمز <b>{shown.name}</b> — أعطه للطبيب ليفتح به نافذة الأطباء:</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg bg-white px-3 py-1.5 font-mono text-lg font-bold tracking-widest" dir="ltr" data-testid="doctor-code-value">{shown.code}</span>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(shown.code); toast.success("نُسخ"); }} className="rounded-lg border border-line bg-white p-2" aria-label="نسخ"><Copy className="size-4" /></button>
            <button type="button" onClick={() => setShown(null)} className="ms-auto text-xs text-muted">إخفاء</button>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={() => start(async () => { const r = await refreshDoctorCodes(); if (!r.ok) toast.error(r.error); else toast.success(r.failed ? `تعذّر تحديث ${r.failed}` : "حُدّثت نسخ الأطباء"); router.refresh(); })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas"><RefreshCw className="size-4" /> تحديث الآن</button>
      </div>
      {rows.length === 0 && <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">أضف الأطباء المحيلين أولاً (الأطباء المُحيلون).</div>}
      {rows.map((r) => {
        const o = opt(r);
        return (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]" data-testid="doctor-code-row">
            <div>
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-muted">
                {r.done} نتيجة معتمدة
                {r.codeId && (r.lastError ? <span className="text-red-600"> · لم تُرفع: {ERR[r.lastError] ?? r.lastError}</span> : r.lastAt ? <span> · رُفعت <bdi dir="ltr">{r.lastAt.slice(0, 16)}</bdi></span> : null)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={o.win} onChange={(e) => setOpts((x) => ({ ...x, [r.id]: { ...o, win: e.target.value } }))} aria-label={`مدة ${r.name}`} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
                {(Object.keys(WINDOW_LABEL) as DoctorWindow[]).map((w) => <option key={w} value={w}>{WINDOW_LABEL[w]}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={o.hide} onChange={(e) => setOpts((x) => ({ ...x, [r.id]: { ...o, hide: e.target.checked } }))} /> إخفاء الهاتف</label>
              <button type="button" disabled={busy} data-testid="doctor-code-create"
                onClick={() => (!r.codeId || confirm("رمز جديد يوقف الرمز القديم. متابعة؟")) && start(async () => {
                  const x = await createDoctorCode(r.id, o.win, o.hide);
                  if (!x.ok) { toast.error(x.error); return; }
                  setShown({ name: r.name, code: x.code });
                  if (x.error) toast.warning(ERR[x.error] ?? x.error);
                  router.refresh();
                })}
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white"><KeyRound className="size-3.5" /> {r.codeId ? "رمز جديد" : "إنشاء رمز"}</button>
              {r.codeId && (
                <>
                  <button type="button" disabled={busy} onClick={() => start(async () => { const x = await showDoctorCode(r.codeId!); if (x.ok) setShown({ name: r.name, code: x.code }); else toast.error(x.error); })}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs"><Eye className="size-3.5" /> إظهار</button>
                  <button type="button" disabled={busy} onClick={() => confirm("إيقاف الرمز؟ لن يرى الطبيب نتائج جديدة.") && start(async () => { await revokeDoctorCode(r.codeId!); router.refresh(); })}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-red-600"><Ban className="size-3.5" /> إيقاف</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
