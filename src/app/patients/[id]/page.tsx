import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const patient = await queryOne<any>(
    `select * from patients where id = $1`,
    [params.id]
  );
  if (!patient) notFound();

  const orders = await query<{
    id: string;
    order_date: string;
    status: string;
    total_amount: number;
    tests: number;
  }>(
    `select o.id, o.order_date, o.status, o.total_amount,
            count(i.id)::int as tests
       from test_orders o
       left join test_order_items i on i.order_id = o.id
      where o.patient_id = $1
      group by o.id
      order by o.order_date desc`,
    [params.id]
  );

  const statusLabel: Record<string, string> = {
    pending: "قيد الانتظار",
    in_progress: "قيد الفحص",
    completed: "مكتمل",
    delivered: "مُسلّم",
  };

  return (
    <div>
      <PageHeader
        title={patient.full_name}
        subtitle="ملف المريض وتاريخه الطبي"
        action={
          <Button href={`/orders/new?patient=${patient.id}`}>
            <Plus className="size-4" /> طلب فحص جديد
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted">الجنس</dt>
            <dd>
              {patient.gender === "male"
                ? "ذكر"
                : patient.gender === "female"
                ? "أنثى"
                : "—"}
            </dd>
            <dt className="text-muted">العمر</dt>
            <dd>{patient.age_years ?? "—"}</dd>
            <dt className="text-muted">الهاتف</dt>
            <dd>{patient.phone ?? "—"}</dd>
            <dt className="text-muted">أمراض مزمنة</dt>
            <dd>{patient.chronic_diseases ?? "—"}</dd>
            <dt className="text-muted">أدوية حالية</dt>
            <dd>{patient.current_meds ?? "—"}</dd>
            <dt className="text-muted">حالة الحمل</dt>
            <dd>{patient.is_pregnant ? "نعم" : "لا"}</dd>
          </dl>
          {patient.notes && (
            <p className="mt-4 rounded-lg bg-canvas p-3 text-sm">
              {patient.notes}
            </p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 font-semibold">سجل الفحوصات (Patient History)</div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">التاريخ</th>
                <th className="px-3 py-2 font-medium">عدد الفحوصات</th>
                <th className="px-3 py-2 font-medium">الحالة</th>
                <th className="px-3 py-2 font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    لا توجد فحوصات بعد
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-line last:border-0 hover:bg-canvas"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-brand-dark hover:underline"
                    >
                      {o.order_date}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{o.tests}</td>
                  <td className="px-3 py-2">{statusLabel[o.status] ?? o.status}</td>
                  <td className="px-3 py-2">{o.total_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
