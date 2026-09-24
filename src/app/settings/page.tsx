import { PageHeader, Card, Button } from "@/components/ui/primitives";
import { cloudApiConfigured } from "@/lib/whatsapp";
import { getLabIdentity } from "@/lib/lab-identity";
import { updateLabIdentity } from "@/app/actions/settings";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

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
  const hostedDb = !!process.env.DATABASE_URL;
  const aiOn = !!process.env.ANTHROPIC_API_KEY;
  const waCloud = cloudApiConfigured();

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" subtitle="حالة النظام والميزات" />

      <Card className="mb-4">
        <div className="mb-1 font-semibold">بيانات الترويسة والطباعة</div>
        <p className="mb-3 text-xs text-muted">تظهر في تقرير النتائج المطبوع ووصل استلام الطلب. اتركها فارغة لإخفائها.</p>
        <form action={updateLabIdentity} className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            السطر تحت اسم المختبر (المؤهّل / الوصف)
            <input name="subtitle" defaultValue={identity.subtitle} maxLength={300} className={`mt-1 ${field}`} />
          </label>
          <label className="text-sm font-medium">
            العنوان ورقم الهاتف (أسفل التقرير والوصل)
            <input name="footer" defaultValue={identity.footer} maxLength={300} placeholder="العنوان - الهاتف" className={`mt-1 ${field}`} />
          </label>
          <div><Button>حفظ</Button></div>
        </form>
      </Card>

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
