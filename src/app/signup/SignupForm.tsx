"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Copy, FlaskConical } from "lucide-react";
import { activateCode, fetchEnabled } from "@/lib/license/client";

const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function SignupForm() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [f, setF] = useState({ lab: "", phone: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ code: string; days: number; active: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/license", { cache: "no-store" }).then((r) => r.json()).then((d) => setOpen(!!d?.enabled && !!d?.signup)).catch(() => setOpen(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/license/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: "offline" }));
    if (!r.ok) {
      setBusy(false);
      setErr(r.error === "too_many" ? "محاولات كثيرة — حاول بعد قليل." : r.error === "bad_request" ? "اكتب اسم المختبر ورقم هاتف صحيحاً."
        : r.error === "closed" ? "التسجيل الذاتي غير متاح حالياً." : "تعذّر التسجيل — تحقّق من الاتصال وحاول مرة أخرى.");
      return;
    }
    // This device starts with the new code at once.
    await fetchEnabled();
    const a = await activateCode(r.code);
    setBusy(false);
    setDone({ code: r.code, days: r.days, active: a.ok });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div data-testid="signup" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white"><FlaskConical className="size-7" /></span>
          <h1 className="text-xl font-bold">تسجيل مختبر جديد</h1>
          <p className="text-sm text-muted">سجّل مختبرك واحصل على رمز تجريبي يعمل على هذا الجهاز فوراً.</p>
        </div>

        {open === null ? <p className="text-center text-sm text-muted">جارٍ التحميل…</p>
        : !open ? (
          <p data-testid="signup-closed" className="rounded-lg bg-canvas p-4 text-center text-sm text-muted">التسجيل الذاتي غير متاح حالياً — تواصل مع المزوّد للحصول على رمز.</p>
        ) : done ? (
          <div data-testid="signup-done" className="space-y-3 text-center">
            <p className="text-sm">تم تسجيل مختبرك. رمزك التجريبي ({done.days} {done.days <= 10 ? "أيام" : "يوماً"}):</p>
            <div className="rounded-xl bg-canvas px-4 py-3 font-mono text-2xl tracking-widest" dir="ltr" data-testid="signup-code">{done.code}</div>
            <button type="button" onClick={() => navigator.clipboard?.writeText(done.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-canvas">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} نسخ الرمز
            </button>
            <p className="text-xs text-muted">{done.active ? "هذا الجهاز مفعّل بالرمز. احتفظ به للتواصل مع المزوّد والتجديد." : "احتفظ بالرمز وأدخله في نافذة التفعيل."}</p>
            <a href="/welcome" className="block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">الدخول إلى المحطات</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-medium">اسم المختبر<input value={f.lab} onChange={(e) => setF({ ...f, lab: e.target.value })} className={field} required minLength={2} /></label>
            <label className="block text-sm font-medium">رقم الهاتف<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} dir="ltr" inputMode="tel" className={field} required /></label>
            <label className="block text-sm font-medium">المدينة <span className="text-muted">(اختياري)</span><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={field} /></label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button disabled={busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              <Building2 className="size-4" /> {busy ? "جارٍ التسجيل…" : "تسجيل وبدء التجربة"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
