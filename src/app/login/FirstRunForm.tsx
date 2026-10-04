"use client";

import { useFormState, useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { firstRunAction } from "@/app/actions/auth";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="mt-2 w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب والدخول"}
    </button>
  );
}

/** First visit to a lab's new database: its first admin account. */
export function FirstRunForm() {
  // Signed in: the panel opens with a full page load (its frame differs from this page's), at once —
  // the page behind this form changes as soon as the account exists.
  const [state, action] = useFormState(async (prev: { error?: string; to?: string; username?: string; full_name?: string }, fd: FormData) => {
    const r = await firstRunAction(prev, fd);
    if (r.to) window.location.replace(r.to);
    return r;
  }, {});
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div data-testid="first-run" className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-pop)]">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg"><UserPlus className="size-7" /></span>
          <h1 className="text-xl font-bold">حساب مدير المختبر</h1>
          <p className="text-sm text-muted">قاعدة بيانات مختبرك جديدة وليس فيها حسابات بعد. أنشئ حساب المدير الأول — تضيف بعده باقي المستخدمين من «المستخدمون».</p>
        </div>
        <form action={action} className="flex flex-col gap-3">
          <label className="text-sm font-medium">الاسم الكامل<input name="full_name" defaultValue={state.full_name ?? ""} className={field} placeholder="مدير المختبر" /></label>
          <label className="text-sm font-medium">اسم المستخدم<input name="username" defaultValue={state.username ?? ""} dir="ltr" autoComplete="username" className={field} /></label>
          <label className="text-sm font-medium">كلمة المرور<input name="password" type="password" dir="ltr" autoComplete="new-password" className={field} /></label>
          <label className="text-sm font-medium">تأكيد كلمة المرور<input name="again" type="password" dir="ltr" autoComplete="new-password" className={field} /></label>
          {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
          <Submit />
        </form>
      </div>
    </div>
  );
}
