import { PageHeader } from "@/components/ui/primitives";
import { CollectWindow } from "@/components/desk/CollectWindow";
import { deskCatalog, deskReferrers, collectToday } from "@/lib/desk/data";

export const dynamic = "force-dynamic";

/** «نافذة ساحب الدم»: the patient and the tests with their prices, the money, the receipt and the tube
 *  labels; the sample then waits in «نافذة المختبر». */
export default async function CollectPage() {
  const [tests, referrers, today] = await Promise.all([deskCatalog(), deskReferrers(), collectToday()]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="نافذة ساحب الدم" subtitle="سجّل المراجع وفحوصاته، استلم المبلغ وأعطه الوصل، والصق ملصقات الأنابيب — تصل العيّنة إلى نافذة المختبر." />
      <CollectWindow tests={tests} referrers={referrers} today={today} />
    </div>
  );
}
