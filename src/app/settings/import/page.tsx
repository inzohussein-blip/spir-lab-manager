import { PageHeader } from "@/components/ui/primitives";
import { StationImport } from "@/components/desk/StationImport";

export const dynamic = "force-dynamic";

/** «استيراد من المحطات»: a lab station's backup file into the admin panel. */
export default function StationImportPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="استيراد من المحطات" subtitle="انقل فحوصات محطة المختبر ومراجعيها ونتائجهم إلى لوحة الإدارة من ملف النسخة الاحتياطية للمحطة (الإعدادات ← النسخ الاحتياطي)." />
      <StationImport />
    </div>
  );
}
