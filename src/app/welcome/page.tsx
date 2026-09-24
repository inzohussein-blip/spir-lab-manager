import Link from "next/link";
import { OfflineReady } from "@/components/local/OfflineReady";
import { Lock, Beaker, ShoppingCart, GraduationCap, ShieldCheck, Users, ArrowLeft } from "lucide-react";

export const metadata = { title: "مختبر التحليلات المرضية — اختيار النسخة" };

// Flip to true when the full paid admin panel is released.
const PAID_UNLOCKED = false;

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <OfflineReady />
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lab-logo.png" alt="" className="size-24 object-contain" />
          <h1 className="mt-3 text-3xl font-extrabold" style={{ color: "#5a2a82" }}>مختبر التحليلات المرضية</h1>
          <p className="mt-4 max-w-xl text-sm text-muted">اختر النسخة التي تريد الدخول إليها. النسخة الكاملة قيد التطوير حالياً، والنسخ المجانية تعمل محلياً بدون إنترنت.</p>
        </div>

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {/* Paid — locked */}
          <div className="relative flex flex-col rounded-2xl border border-line bg-surface p-6 opacity-80 shadow-[var(--shadow-card)]">
            <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              <Lock className="size-3" /> مقفلة حالياً
            </span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              <Lock className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">لوحة الإدارة الكاملة</div>
            <p className="mt-1 flex-1 text-sm text-muted">النسخة المدفوعة: إدارة كاملة للمرضى والطلبات والنتائج والفواتير والمخزون والتقارير — تتطلّب تسجيل دخول وقاعدة بيانات.</p>
            <button
              disabled={!PAID_UNLOCKED}
              className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-muted"
            >
              <Lock className="size-4" /> قريباً
            </button>
          </div>

          {/* Free — Lab Station */}
          <Link href="/station" className="group flex flex-col rounded-2xl border-2 border-brand/40 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-brand">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-brand-dark">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              <Beaker className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة المختبر</div>
            <p className="mt-1 flex-1 text-sm text-muted">إدخال وطباعة نتائج الفحوصات بدون إنترنت — واجهة مبسّطة تعمل محلياً على حاسوب المختبر دون قاعدة بيانات.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-brand-dark">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>

          {/* Free — Purchasing */}
          <Link href="/store" className="group flex flex-col rounded-2xl border-2 border-amber-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-amber-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm">
              <ShoppingCart className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">منظومة المشتريات</div>
            <p className="mt-1 flex-1 text-sm text-muted">نسخة محلية مستقلة لإدارة المشتريات والموردين ومتابعة المصروف — منفصلة تماماً عن النسختين الأخريين.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-amber-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>

          {/* Free — Training & information (fully separate) */}
          <Link href="/training" className="group flex flex-col rounded-2xl border-2 border-indigo-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-indigo-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm">
              <GraduationCap className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة التدريب والمعلومات</div>
            <p className="mt-1 flex-1 text-sm text-muted">دليل عملي لكل فحص: البروسيجر، العينات والتيوبات، الأدوات، التفسير والربط بين الفحوصات — مع الصور والطباعة. محطة منفصلة بالكامل.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-indigo-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>

          {/* Free — Quality & devices (fully separate) */}
          <Link href="/qc" className="group flex flex-col rounded-2xl border-2 border-rose-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-rose-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm">
              <ShieldCheck className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة الجودة والأجهزة</div>
            <p className="mt-1 flex-1 text-sm text-muted">سيطرة نوعية يومية مع مخطط Levey-Jennings وقواعد Westgard، سجلات حرارة الثلاجات والحاضنات، وصيانة ومعايرة الأجهزة. محطة منفصلة بالكامل.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-rose-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>

          {/* Free — Staff & shifts (fully separate) */}
          <Link href="/roster" className="group flex flex-col rounded-2xl border-2 border-sky-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-sky-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm">
              <Users className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة الكادر والدوام</div>
            <p className="mt-1 flex-1 text-sm text-muted">جدول المناوبات الأسبوعي، الحضور والانصراف والتأخير، الإجازات وأرصدتها، السلف وكشف الرواتب الشهري. محطة منفصلة بالكامل.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-sky-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>
        </div>

      </div>
    </div>
  );
}
