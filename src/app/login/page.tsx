"use client";

import { useFormState, useFormStatus } from "react-dom";
import { FlaskConical } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow">
            <FlaskConical className="size-6" />
          </span>
          <h1 className="text-xl font-bold">مختبر التحاليل الطبية</h1>
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
      </div>
    </div>
  );
}
