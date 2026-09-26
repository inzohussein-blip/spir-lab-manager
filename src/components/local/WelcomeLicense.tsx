"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useLicense } from "@/components/local/ActivationGate";
import type { LicenseModule } from "@/lib/license/modules";

/** A station card on the Welcome page — greyed out when the lab code does not include it. */
export function LicensedLink({ module, href, className, children }: { module: LicenseModule; href: string; className: string; children: ReactNode }) {
  const { state } = useLicense(module);
  if (state?.kind === "module_off") {
    return (
      <div className={`${className} pointer-events-none relative opacity-50 grayscale`} aria-disabled="true">
        <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          <Lock className="size-3" /> غير مفعّلة في رمزك
        </span>
        {children}
      </div>
    );
  }
  return <Link href={href} className={className}>{children}</Link>;
}

/** The full admin panel card: opens only on a device whose lab code includes it. */
export function AdminPanelCard() {
  const { state } = useLicense("admin");
  const open = state?.kind === "ok";
  const why = !state || state.kind === "off" ? "مقفلة حالياً" : "غير مفعّلة في رمزك";
  if (open) {
    return (
      <Link href="/login" className="group flex flex-col rounded-2xl border-2 border-violet-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-violet-500">
        <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm">
          <LayoutDashboard className="size-6" />
        </span>
        <div className="mt-4 text-lg font-bold">لوحة الإدارة الكاملة</div>
        <p className="mt-1 flex-1 text-sm text-muted">إدارة كاملة للمرضى والطلبات والنتائج والفواتير والمخزون والتقارير — تتطلّب تسجيل دخول وقاعدة بيانات.</p>
        <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-violet-700">
          الدخول <ArrowLeft className="size-4" />
        </span>
      </Link>
    );
  }
  return (
    <div className="relative flex flex-col rounded-2xl border border-line bg-surface p-6 opacity-80 shadow-[var(--shadow-card)]">
      <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        <Lock className="size-3" /> {why}
      </span>
      <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
        <Lock className="size-6" />
      </span>
      <div className="mt-4 text-lg font-bold">لوحة الإدارة الكاملة</div>
      <p className="mt-1 flex-1 text-sm text-muted">النسخة المدفوعة: إدارة كاملة للمرضى والطلبات والنتائج والفواتير والمخزون والتقارير — تتطلّب تسجيل دخول وقاعدة بيانات.</p>
      <button disabled className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-muted">
        <Lock className="size-4" /> {state?.kind === "off" || !state ? "قريباً" : "غير مفعّلة"}
      </button>
    </div>
  );
}
