import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import { Beaker, ShoppingCart, GraduationCap, ShieldCheck, Users, ArrowLeft } from "lucide-react";
import { LicensedLink, AdminPanelCard, AdminLockedNotice } from "@/components/local/WelcomeLicense";

export const metadata = { title: "مختبر التحليلات المرضية — اختيار النسخة" };

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate />
      <OfflineReady />
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lab-logo.png" alt="" className="size-24 object-contain" />
          <h1 className="mt-3 text-3xl font-extrabold" style={{ color: "#5a2a82" }}>مختبر التحليلات المرضية</h1>
          <p className="mt-4 max-w-xl text-sm text-muted">اختر النسخة التي تريد الدخول إليها. النسخة الكاملة قيد التطوير حالياً، والنسخ المجانية تعمل محلياً بدون إنترنت.</p>
        </div>

        <AdminLockedNotice />

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {/* Full admin panel — opens only when this device's lab code includes it */}
          <AdminPanelCard />

          {/* Free — Lab Station */}
          <LicensedLink module="station" href="/station" className="group flex flex-col rounded-2xl border-2 border-brand/40 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-brand">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-brand-dark">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              <Beaker className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة المختبر</div>
            <p className="mt-1 flex-1 text-sm text-muted">إدخال وطباعة نتائج الفحوصات بدون إنترنت — واجهة مبسّطة تعمل محلياً على حاسوب المختبر دون قاعدة بيانات.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-brand-dark">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Purchasing */}
          <LicensedLink module="purchasing" href="/store" className="group flex flex-col rounded-2xl border-2 border-amber-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-amber-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm">
              <ShoppingCart className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">منظومة المشتريات</div>
            <p className="mt-1 flex-1 text-sm text-muted">نسخة محلية مستقلة لإدارة المشتريات والموردين ومتابعة المصروف — منفصلة تماماً عن النسختين الأخريين.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-amber-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Training & information (fully separate) */}
          <LicensedLink module="training" href="/training" className="group flex flex-col rounded-2xl border-2 border-indigo-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-indigo-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm">
              <GraduationCap className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة التدريب والمعلومات</div>
            <p className="mt-1 flex-1 text-sm text-muted">دليل عملي لكل فحص: البروسيجر، العينات والتيوبات، الأدوات، التفسير والربط بين الفحوصات — مع الصور والطباعة. محطة منفصلة بالكامل.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-indigo-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Quality & devices (fully separate) */}
          <LicensedLink module="qc" href="/qc" className="group flex flex-col rounded-2xl border-2 border-rose-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-rose-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm">
              <ShieldCheck className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة الجودة والأجهزة</div>
            <p className="mt-1 flex-1 text-sm text-muted">سيطرة نوعية يومية مع مخطط Levey-Jennings وقواعد Westgard، سجلات حرارة الثلاجات والحاضنات، وصيانة ومعايرة الأجهزة. محطة منفصلة بالكامل.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-rose-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Staff & shifts (fully separate) */}
          <LicensedLink module="roster" href="/roster" className="group flex flex-col rounded-2xl border-2 border-sky-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-sky-500">
            <span className="absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">مجانية</span>
            <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm">
              <Users className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة الكادر والدوام</div>
            <p className="mt-1 flex-1 text-sm text-muted">جدول المناوبات الأسبوعي، الحضور والانصراف والتأخير، الإجازات وأرصدتها، السلف وكشف الرواتب الشهري. محطة منفصلة بالكامل.</p>
            <span className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-sky-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>
        </div>

      </div>
    </div>
  );
}
