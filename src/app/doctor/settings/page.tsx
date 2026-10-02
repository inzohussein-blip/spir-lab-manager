"use client";

import { Settings, ShieldCheck, LogOut, Info } from "lucide-react";
import { SettingsLayout } from "@/components/SettingsLayout";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { THEME_KEYS } from "@/lib/local/theme";
import { forgetAll, labs, useDoctor } from "@/lib/doctors/viewer";
import { card } from "@/components/sync/parts";

/** «إعدادات نافذة الأطباء»: the look, a PIN for this device, and «خروج» (forget everything here). */
export default function DoctorSettings() {
  useDoctor();
  const n = labs().length;
  return (
    <SettingsLayout
      title="إعدادات نافذة الأطباء"
      icon={<Settings className="size-6" />}
      sections={[
        {
          id: "look", label: "الأمان والمظهر", hint: "رمز الدخول والألوان", icon: <ShieldCheck />,
          content: (
            <>
              <PinCard station="doctor" />
              <ThemeCard storageKey={THEME_KEYS.doctor} />
            </>
          ),
        },
        {
          id: "leave", label: "الخروج", hint: "مسح النتائج من هذا الجهاز", icon: <LogOut />,
          content: (
            <section className={card} data-testid="doctor-leave">
              <div className="mb-1 font-bold">خروج من هذا الجهاز</div>
              <p className="mb-3 text-sm text-muted">يمسح رموز المختبرات ({n}) والنتائج المحفوظة على هذا الجهاز. تستطيع إضافتها مرة أخرى بالرموز نفسها ما دام المختبر لم يوقفها.</p>
              <button disabled={!n} onClick={() => { if (window.confirm("مسح كل المختبرات ونتائجها من هذا الجهاز؟")) forgetAll(); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                <LogOut className="size-4" /> خروج ومسح البيانات
              </button>
            </section>
          ),
        },
        {
          id: "about", label: "عن النافذة", hint: "كيف تصل النتائج", icon: <Info />,
          content: (
            <section className={`${card} space-y-2 text-sm`}>
              <p>يعطيك المختبر «رمز الطبيب» من «محطة المزامنة»، فترى هنا نتائج المراجعين الذين أرسلتهم إليه — للمدة التي يختارها المختبر (آخر يوم أو أسبوع أو شهر أو سنة).</p>
              <p>النتائج تُشفّر على حاسوب المختبر برمزك، ويحفظ الخادم نسخة مشفّرة لا يستطيع قراءتها؛ تُفتح على جهازك فقط.</p>
              <p>إذا أوقف المختبر الرمز أو أعطاك رمزاً جديداً، تتوقف النتائج عن الوصول بالرمز القديم.</p>
            </section>
          ),
        },
      ]}
    />
  );
}
