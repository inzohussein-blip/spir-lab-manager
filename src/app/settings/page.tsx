import { Card } from "@/components/ui/primitives";
import { Settings as SettingsIcon, Palette, ListPlus, Database, Info } from "lucide-react";
import { SettingsLayout } from "@/components/SettingsLayout";
import { IdentityForm } from "@/components/IdentityForm";
import { cloudApiConfigured } from "@/lib/whatsapp";
import { DEFAULT_LAB_NAME, getLabIdentity, getReportLook, labLogo, labName } from "@/lib/lab-identity";
import { ReportLookCard } from "@/components/ReportLookCard";
import { LogoCard } from "@/components/LogoCard";
import { labCodeId } from "@/lib/db/lab";
import { getAdminDb } from "@/lib/license/server";
import { connHost } from "@/lib/sync/protocol";
import { LabDbCard } from "@/components/LabDbCard";
import { ImportTestsCard } from "@/components/ImportTestsCard";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-3 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={
          "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
          (ok === undefined
            ? "bg-canvas text-ink"
            : ok
            ? "bg-teal-50 text-brand-dark"
            : "bg-amber-50 text-amber-700")
        }
      >
        {value}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  const identity = await getLabIdentity();
  const look = await getReportLook();
  const lid = await labCodeId();
  const own = lid ? await getAdminDb(lid).catch(() => null) : null;
  const hostedDb = !!process.env.DATABASE_URL || !!own;
  const tests = (await queryOne<{ n: number }>(`select count(*)::int as n from test_catalog`).catch(() => null))?.n ?? 0;
  const aiOn = !!process.env.ANTHROPIC_API_KEY;
  const waCloud = cloudApiConfigured();

  const customized = [identity.name, identity.logo, look.primary !== "#5a2a82" || look.accent !== "#c9a227" || look.intensity !== 100, look.signatureOn, look.lang === "en"].filter(Boolean).length;

  return (
    <SettingsLayout
      title="الإعدادات"
      icon={<SettingsIcon className="size-6" />}
      sections={[
        {
          id: "identity", label: "هوية المختبر والتقرير", hint: "الاسم والشعار والألوان والتوقيع واللغة", icon: <Palette />,
          badge: customized ? `${customized} مخصّص` : null,
          content: (
            <>
              <Card>
                <div className="mb-1 font-semibold">هوية المختبر والطباعة</div>
                <p className="mb-3 text-xs text-muted">اسم مختبرك وشعاره يظهران في لوحة الإدارة وعلى تقرير النتائج ووصل الاستلام. الأسطر الأخرى تُترك فارغة لإخفائها.</p>
                <IdentityForm name={identity.name} subtitle={identity.subtitle} footer={identity.footer} placeholder={DEFAULT_LAB_NAME} />
                <LogoCard logo={labLogo(identity)} isDefault={!identity.logo} />
              </Card>
              <ReportLookCard look={look} lab={{ name: labName(identity), subtitle: identity.subtitle, footer: identity.footer, logo: labLogo(identity) }} />
            </>
          ),
        },
        {
          id: "tests", label: "الفحوصات", hint: "استيراد القائمة الافتراضية", icon: <ListPlus />, badge: `${tests} فحص`,
          content: <ImportTestsCard count={tests} />,
        },
        {
          id: "database", label: "قاعدة البيانات", hint: "أين تُحفظ بيانات المختبر", icon: <Database />,
          badge: own ? "قاعدة خاصة" : null,
          content: (
            <>
              <Card>
                <div className="mb-2 font-semibold">قاعدة البيانات</div>
                <Row
                  label="وضع التخزين"
                  value={own ? "قاعدة المختبر الخاصة" : hostedDb ? "قاعدة مستضافة (دائمة)" : "PGlite (عرض مؤقّت)"}
                  ok={hostedDb}
                />
                <Row label="النموذج" value="Postgres" />
              </Card>
              {lid && <LabDbCard host={own ? connHost(own.conn) : ""} by={own?.by ?? ""} />}
            </>
          ),
        },
        {
          id: "about", label: "حول النظام", hint: "الميزات والإصدار", icon: <Info />,
          content: (
            <>
              <Card>
                <div className="mb-2 font-semibold">الميزات</div>
                <Row
                  label="المساعد الذكي (Claude)"
                  value={aiOn ? "مُفعّل" : "غير مُفعّل — أضف ANTHROPIC_API_KEY"}
                  ok={aiOn}
                />
                <Row
                  label="واتساب"
                  value={waCloud ? "Cloud API الرسمي" : "روابط wa.me (MVP)"}
                  ok={waCloud}
                />
              </Card>
              <Card>
                <div className="mb-2 font-semibold">حول التطبيق</div>
                <Row label="الاسم" value="Spir Lab Manager" />
                <Row label="الإصدار" value={process.env.LAB_VERSION || "—"} />
                <Row label="الواجهة" value="عربي RTL · فاتح/داكن" />
                <p className="mt-3 text-xs text-muted">
                  لتفعيل الميزات المعطّلة، اضبط متغيّرات البيئة على Vercel ثم أعد النشر.
                </p>
              </Card>
            </>
          ),
        },
      ]}
    />
  );
}
