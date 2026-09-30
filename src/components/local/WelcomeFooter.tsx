"use client";

import { Palette, Building2, ShieldCheck, Scale, ChevronDown } from "lucide-react";
import { SiteThemeSwitch } from "@/components/local/LocalTheme";

const card = "rounded-2xl border border-line bg-surface p-5 text-start shadow-[var(--shadow-card)]";

/** One policy, folded under its title (open to read). */
function Policy({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <details className={`${card} group`} data-testid={id}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="[&>svg]:size-4 text-brand-dark">{icon}</span> {title}
        <ChevronDown className="ms-auto size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2 text-xs leading-6 text-muted">{children}</div>
    </details>
  );
}

/**
 * The bottom of the welcome page: the appearance (light / dark / the computer's), who SPIR is,
 * and the privacy policy and disclaimer.
 */
export function WelcomeFooter() {
  return (
    <div className="mt-8 grid items-start gap-4 md:grid-cols-2" data-testid="welcome-footer">
      <div className={card} data-testid="welcome-theme">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Palette className="size-4 text-brand-dark" /> المظهر</div>
        <p className="mb-3 text-xs text-muted">فاتح أو غامق، أو تلقائي حسب إعداد الجهاز. تتبعه كل محطة مضبوطة على «تلقائي» في إعداداتها.</p>
        <SiteThemeSwitch />
      </div>

      <div className={card} data-testid="about-spir">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-brand-dark" /> عن SPIR</div>
        <p className="text-xs leading-6 text-muted">
          <b className="text-ink">SPIR</b> شركة برمجة متخصصة في تطوير الأنظمة والتطبيقات، ومنها منظومة المختبر هذه:
          محطات تعمل على حاسوب المختبر بدون إنترنت، ولوحة إدارة كاملة، مع التفعيل والتحديثات والدعم الفني.
        </p>
      </div>

      <Policy id="privacy" icon={<ShieldCheck />} title="سياسة الخصوصية">
        <p>بيانات المحطات (المراجعون والنتائج والمخزن والكادر وغيرها) تُحفظ على جهاز المختبر نفسه، ولا تُرسل إلى أي جهة.</p>
        <p>عند تفعيل رمز المختبر يتصل الجهاز بالخادم للتحقق من الاشتراك فقط (الرمز ومعرّف الجهاز وإصدار البرنامج)، دون أي بيانات للمراجعين.</p>
        <p>المزامنة بين حواسيب المختبر وقاعدة بيانات المختبر لا تعمل إلا إذا فعّلها المختبر بنفسه، وتُرسل البيانات حينها إلى مكان المختبر الخاص فقط.</p>
        <p>لا نبيع أي بيانات ولا نشاركها مع أي طرف. المختبر مسؤول عن حماية أجهزته ونسخه الاحتياطية وعن حقوق وصول موظفيه.</p>
      </Policy>

      <Policy id="disclaimer" icon={<Scale />} title="إخلاء المسؤولية">
        <p className="font-semibold text-ink">نحن لا نتحمل أي مسؤولية.</p>
        <p>يُقدَّم البرنامج «كما هو» أداةً مساعدة لتنظيم عمل المختبر، ولا تتحمل SPIR أي مسؤولية عن:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>صحة النتائج المُدخلة أو المطبوعة، أو المعدلات الطبيعية والحسابات التلقائية؛</li>
          <li>أي تشخيص أو قرار طبي أو علاجي يُبنى على التقارير؛</li>
          <li>فقدان البيانات أو تلفها لأي سبب، بما فيه عدم أخذ نسخة احتياطية؛</li>
          <li>أي ضرر مباشر أو غير مباشر ينتج عن استخدام البرنامج أو تعذّر استخدامه.</li>
        </ul>
        <p>مراجعة النتائج والتقارير واعتمادها مسؤولية المختبر والمختص المعتمِد وحدهما. استخدام البرنامج يعني الموافقة على ذلك.</p>
      </Policy>
    </div>
  );
}
