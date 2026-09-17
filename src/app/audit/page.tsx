import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "order.created": "إنشاء طلب فحص",
  "order.status": "تغيير حالة الطلب",
  "result.saved": "حفظ نتيجة",
  "report.sent": "إرسال تقرير",
  "patient.created": "إضافة مريض",
};

function summarize(action: string, details: any): string {
  if (!details) return "";
  if (action === "order.created") return `عدد الفحوصات ${details.tests}، المبلغ ${details.total}`;
  if (action === "order.status") return `الحالة: ${details.status}`;
  if (action === "result.saved") return `القيمة: ${details.value}`;
  if (action === "report.sent") return `القناة: ${details.channel}`;
  if (action === "patient.created") return details.name ?? "";
  return "";
}

export default async function AuditPage() {
  const rows = await query<any>(
    `select action, entity, actor_name, details, created_at
       from audit_log order by created_at desc limit 200`
  );

  return (
    <div>
      <PageHeader
        title="سجل التدقيق"
        subtitle="تتبّع غير قابل للتغيير لكل إجراء (من فعل ماذا ومتى)"
      />
      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الوقت</th>
              <th className="px-4 py-3 font-medium">الإجراء</th>
              <th className="px-4 py-3 font-medium">التفاصيل</th>
              <th className="px-4 py-3 font-medium">المستخدم</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  لا توجد أحداث مسجّلة بعد
                </td>
              </tr>
            )}
            {rows.map((r: any, i: number) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {String(r.created_at).slice(0, 19).replace("T", " ")}
                </td>
                <td className="px-4 py-3 font-medium">
                  {ACTION_LABEL[r.action] ?? r.action}
                </td>
                <td className="px-4 py-3 text-muted">
                  {summarize(r.action, r.details)}
                </td>
                <td className="px-4 py-3">{r.actor_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
