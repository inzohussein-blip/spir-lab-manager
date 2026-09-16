import { PageHeader, Card } from "@/components/ui/primitives";
import { cloudApiConfigured } from "@/lib/whatsapp";

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

export default function SettingsPage() {
  const hostedDb = !!process.env.DATABASE_URL;
  const aiOn = !!process.env.ANTHROPIC_API_KEY;
  const waCloud = cloudApiConfigured();

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" subtitle="حالة النظام والميزات" />

      <Card className="mb-4">
        <div className="mb-2 font-semibold">قاعدة البيانات</div>
        <Row
          label="وضع التخزين"
          value={hostedDb ? "قاعدة مستضافة (دائمة)" : "PGlite (عرض مؤقّت)"}
          ok={hostedDb}
        />
        <Row label="النموذج" value="Postgres" />
      </Card>

      <Card className="mb-4">
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
        <Row label="الواجهة" value="عربي RTL · فاتح/داكن" />
        <p className="mt-3 text-xs text-muted">
          لتفعيل الميزات المعطّلة، اضبط متغيّرات البيئة على Vercel ثم أعد النشر.
        </p>
      </Card>
    </div>
  );
}
