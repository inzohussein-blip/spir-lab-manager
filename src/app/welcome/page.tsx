import { OfflineReady } from "@/components/local/OfflineReady";
import { ActivationGate } from "@/components/local/ActivationGate";
import { ACTIVATION_SCRIPT } from "@/lib/local/activation";
import Link from "next/link";
import { Beaker, ShoppingCart, GraduationCap, ShieldCheck, Users, ArrowLeft, Phone, RefreshCw, Info, MessagesSquare, Gauge } from "lucide-react";
import { LicensedLink, AdminPanelCard } from "@/components/local/WelcomeLicense";
import { WelcomeAccount } from "@/components/local/WelcomeAccount";
import { WelcomeFooter } from "@/components/local/WelcomeFooter";

export const metadata = { title: "مختبر التحليلات المرضية — اختيار النسخة" };

export default function WelcomePage() {
  return (
    <div className="welcome min-h-screen bg-canvas">
      <script dangerouslySetInnerHTML={{ __html: ACTIVATION_SCRIPT }} />
      <ActivationGate />
      <OfflineReady />
      <div className="relative mx-auto max-w-5xl px-4 py-10">
        {/* This device's lab and subscription (top left; above the header on phones) */}
        <div className="mb-4 flex justify-end md:absolute md:left-4 md:top-4 md:mb-0">
          <WelcomeAccount />
        </div>
        {/* Header — the new green look's own (the classic one below is shown otherwise) */}
        <div className="ui-only-new mb-10 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lab-logo.png" alt="" className="size-20 object-contain" />
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand-dark">مختبر التحليلات المرضية</h1>
          <p className="mt-4 max-w-xl text-sm text-muted">اختر النسخة التي تريد الدخول إليها. النسخة الكاملة قيد التطوير حالياً، والنسخ المجانية تعمل محلياً بدون إنترنت.</p>
        </div>
        {/* Header */}
        <div className="ui-only-classic mb-10 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lab-logo.png" alt="" className="size-24 object-contain" />
          <h1 className="mt-3 text-3xl font-extrabold" style={{ color: "#5a2a82" }}>مختبر التحليلات المرضية</h1>
          <p className="mt-4 max-w-xl text-sm text-muted">اختر النسخة التي تريد الدخول إليها. النسخة الكاملة قيد التطوير حالياً، والنسخ المجانية تعمل محلياً بدون إنترنت.</p>
        </div>

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {/* The new look's dashboard (only in that look; the lab station's «لوحة التحكم») */}
          <LicensedLink module="station" href="/station/dashboard" className="ui-only-new group relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[var(--ui-a,#14733f)] to-[var(--ui-deep,#0b4527)] p-6 text-white shadow-[var(--shadow-card)] md:col-span-2 xl:col-span-3">
            <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.1]" aria-hidden><defs><pattern id="wl-wave" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M0 15 Q7.5 0 15 15 T30 15" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#wl-wave)" /></svg>
            <div className="relative flex flex-wrap items-center gap-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-white/15"><Gauge className="size-7" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-extrabold">لوحة التحكم</div>
                <p className="mt-1 text-sm text-white/80">زيارات اليوم والأسبوع والشهر، والنتائج المنتظرة والجاهزة للتسليم، والتحليلات، ولوحة المهام — من بيانات هذا الجهاز.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ui-a-dark,#0e5530)] group-hover:brightness-95">الدخول <ArrowLeft className="size-4" /></span>
            </div>
          </LicensedLink>
          {/* Full admin panel — opens only when this device's lab code includes it */}
          <AdminPanelCard />

          {/* Free — Lab Station */}
          <LicensedLink module="station" href="/station" className="ui-station-card group flex flex-col rounded-2xl border-2 border-brand/40 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-brand">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-brand-dark">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              <Beaker className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة المختبر</div>
            <p className="mt-1 flex-1 text-sm text-muted">إدخال وطباعة نتائج الفحوصات بدون إنترنت — واجهة مبسّطة تعمل محلياً على حاسوب المختبر دون قاعدة بيانات.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-brand-dark">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Purchasing */}
          <LicensedLink module="purchasing" href="/store" className="ui-station-card group flex flex-col rounded-2xl border-2 border-amber-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-amber-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm">
              <ShoppingCart className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">المخزن والمشتريات</div>
            <p className="mt-1 flex-1 text-sm text-muted">إدارة المشتريات والموردين ومتابعة المصروف، والمخزن المرتبط بمحطة المختبر والجودة: يُضاف إليه ما يُشترى ويُحسم منه ما يُستعمل.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-amber-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Training & information (fully separate) */}
          <LicensedLink module="training" href="/training" className="ui-station-card group flex flex-col rounded-2xl border-2 border-indigo-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-indigo-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm">
              <GraduationCap className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة التدريب والمعلومات</div>
            <p className="mt-1 flex-1 text-sm text-muted">دليل عملي لكل فحص: البروسيجر، العينات والتيوبات، الأدوات، التفسير والربط بين الفحوصات — مع الصور والطباعة. محطة منفصلة بالكامل.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-indigo-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Quality & devices (fully separate) */}
          <LicensedLink module="qc" href="/qc" className="ui-station-card group flex flex-col rounded-2xl border-2 border-rose-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-rose-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm">
              <ShieldCheck className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة الجودة والأجهزة</div>
            <p className="mt-1 flex-1 text-sm text-muted">سيطرة نوعية يومية مع مخطط Levey-Jennings وقواعد Westgard، سجلات حرارة الثلاجات والحاضنات، وصيانة ومعايرة الأجهزة. مرتبطة بالمخزن والكادر والموردين.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-rose-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Staff & shifts (fully separate) */}
          <LicensedLink module="roster" href="/roster" className="ui-station-card group flex flex-col rounded-2xl border-2 border-sky-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-sky-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm">
              <Users className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة الكادر والدوام</div>
            <p className="mt-1 flex-1 text-sm text-muted">جدول المناوبات الأسبوعي، الحضور والانصراف والتأخير، الإجازات وأرصدتها، السلف وكشف الرواتب الشهري. أسماء الكادر متاحة في المحطات الأخرى.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-sky-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — the lab's computers, other labs and «المحادثة العامة» */}
          <LicensedLink module="connect" href="/connect" className="ui-station-card group flex flex-col rounded-2xl border-2 border-emerald-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-emerald-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
              <MessagesSquare className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة التواصل</div>
            <p className="mt-1 flex-1 text-sm text-muted">محادثة داخلية بين حواسيب المختبر، ورسائل مشفّرة لمختبر آخر (اتصال مباشر أو ملف أو صندوق بريد مشفّر)، و«المحادثة العامة» مع كل المختبرات.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-emerald-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </LicensedLink>

          {/* Free — Sync between the lab's computers (every activated computer) */}
          <Link href="/sync" data-testid="sync-card" className="ui-station-card group flex flex-col rounded-2xl border-2 border-violet-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-violet-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">مجانية</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm">
              <RefreshCw className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">محطة المزامنة</div>
            <p className="mt-1 flex-1 text-sm text-muted">مزامنة بيانات المحطات بين حواسيب المختبر نفسه: ملف مزامنة من حاسوب يُدخل في الآخر، أو مزامنة تلقائية عبر الإنترنت، فيُضاف الناقص ويؤخذ الأحدث.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-violet-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>
          {/* About the app — open to everyone */}
          <Link href="/about" data-testid="about-card" className="ui-station-card group flex flex-col rounded-2xl border-2 border-purple-300 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-purple-500">
            <span className="ui-chip absolute -mt-9 ms-auto inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">للجميع</span>
            <span className="ui-tile grid size-12 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-sm">
              <Info className="size-6" />
            </span>
            <div className="mt-4 text-lg font-bold">عن التطبيق</div>
            <p className="mt-1 flex-1 text-sm text-muted">شرح التطبيق وكل محطة وميزاتها بالتفصيل مع صور مبسّطة: البدء السريع، النصائح، الأسئلة الشائعة، البيانات والنسخ الاحتياطي، والدعم.</p>
            <span className="ui-go mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white group-hover:bg-purple-700">
              الدخول <ArrowLeft className="size-4" />
            </span>
          </Link>
        </div>

        {/* Contact */}
        <div className="mt-10 flex flex-col items-center gap-2 border-t border-line pt-6 text-center">
          <div className="text-sm font-semibold">للاشتراك والتفعيل والدعم الفني</div>
          <a href="tel:07803993585" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-base font-bold tabular-nums shadow-[var(--shadow-card)] hover:border-brand" dir="ltr">
            <Phone className="size-4 text-brand-dark" /> 07803993585
          </a>
          {/* The version this device runs (the saved offline copy may be older than the site). */}
          <div className="mt-2 text-[11px] text-muted" data-testid="app-version">الإصدار: <span dir="ltr" className="tabular-nums">{process.env.LAB_VERSION}</span></div>
        </div>

        {/* Appearance, about SPIR, privacy and disclaimer */}
        <WelcomeFooter />
        <p className="mt-6 text-center text-[11px] text-muted">© <span className="tabular-nums">{new Date().getFullYear()}</span> SPIR — جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
