import { PageHeader } from "@/components/ui/primitives";
import { LabWindow } from "@/components/desk/LabWindow";
import { deskCatalog, deskReferrers, labQueue, labPrint, labRules } from "@/lib/desk/data";
import { getLabIdentity, labName } from "@/lib/lab-identity";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/** «نافذة المختبر»: the collector's samples and the ones entered here directly (no prices); results
 *  as at the lab station, verification (optionally by a second person), critical values, printing. */
export default async function LabPage() {
  const [queue, tests, referrers, print, rules, identity, user] = await Promise.all([
    labQueue(), deskCatalog(), deskReferrers(), labPrint(), labRules(), getLabIdentity(), getCurrentUser(),
  ]);
  return (
    <div>
      <div className="no-print">
        <PageHeader title="نافذة المختبر" subtitle="عيّنات ساحب الدم، أو أضف عيّنة مباشرة كما في محطة المختبر — النتائج فقط بلا أسعار." />
      </div>
      <LabWindow
        queue={queue}
        tests={tests}
        referrers={referrers}
        print={print}
        rules={rules}
        letterhead={{ name: labName(identity), subtitle: identity.subtitle, footer: identity.footer, logo: identity.logo }}
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
