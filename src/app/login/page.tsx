"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { FlaskConical, Beaker } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-lg bg-brand py-2.5 font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "جارٍ الدخول…" : "تسجيل الدخول"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState(loginAction, {});
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-pop)]">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg">
            <FlaskConical className="size-7" />
          </span>
          <h1 className="text-xl font-bold">مختبر التحليلات المرضية</h1>
          <p className="text-sm text-muted">تسجيل الدخول إلى لوحة الإدارة</p>
        </div>
        <form action={action} className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            اسم المستخدم
            <input
              name="username"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand"
              defaultValue="admin"
            />
          </label>
          <label className="text-sm font-medium">
            كلمة المرور
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}
          <SubmitBtn />
        </form>
        <p className="mt-4 text-center text-xs text-muted">
          للتجربة: admin / admin123
        </p>

        <div className="mt-5 border-t border-line pt-4">
          <Link
            href="/station"
            className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas"
          >
            <Beaker className="size-4 text-brand-dark" />
            محطة المختبر — إدخال وطباعة بدون إنترنت
          </Link>
          <p className="mt-2 text-center text-[11px] text-muted">
            واجهة مبسّطة تعمل محلياً على حاسوب المختبر دون قاعدة بيانات
          </p>
        </div>
      </div>
    </div>
  );
}
