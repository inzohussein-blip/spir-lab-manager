import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, UserRound, CalendarClock, Coins, Activity } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, Button, StatTile, Badge } from "@/components/ui/primitives";
import { PaymentBadge } from "@/components/PaymentBadge";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد الفحص",
  completed: "مكتمل",
  delivered: "مُسلّم",
};

export default async function PatientDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const patient = await queryOne<any>(
    `select * from patients where id = $1`,
    [params.id]
  );
  if (!patient) notFound();

  const orders = await query<{
    id: string;
    accession_no: string | null;
    order_date: string;
    status: string;
    payment_status: string | null;
    total_amount: number;
    tests: number;
  }>(
    `select o.id, o.accession_no, o.order_date, o.status, o.payment_status,
            o.total_amount, count(i.id)::int as tests
       from test_orders o
       left join test_order_items i on i.order_id = o.id
      where o.patient_id = $1
      group by o.id
      order by o.order_date desc`,
    [params.id]
  );

  const visits = orders.length;
  const spend = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const lastVisit = orders[0]?.order_date ?? "—";
  const genderText =
    patient.gender === "male" ? "ذكر" : patient.gender === "female" ? "أنثى" : "—";

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

      {/* Identity strip */}
      <Card className="mb-4 flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-light text-xl font-bold text-brand-dark">
          {patient.full_name?.trim()?.[0] ?? <UserRound className="size-6" />}
        </span>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={patient.gender === "female" ? "info" : "brand"}>{genderText}</Badge>
          {patient.age_years != null && <Badge>{patient.age_years} سنة</Badge>}
          {patient.phone && <span className="text-muted">☎ {patient.phone}</span>}
          {patient.is_pregnant && <Badge tone="warn">حامل</Badge>}
        </div>
      </Card>

      {/* Summary */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="عدد الزيارات" value={visits} icon={<Activity className="size-5" />} />
        <StatTile label="إجمالي الإنفاق" value={`${money(spend)} د.ع`} icon={<Coins className="size-5" />} />
        <StatTile label="آخر زيارة" value={lastVisit} tone="neutral" icon={<CalendarClock className="size-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="mb-3 text-sm font-semibold">المعلومات الطبية</div>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted">أمراض مزمنة</dt>
            <dd>{patient.chronic_diseases ?? "—"}</dd>
            <dt className="text-muted">أدوية حالية</dt>
            <dd>{patient.current_meds ?? "—"}</dd>
            <dt className="text-muted">حالة الحمل</dt>
            <dd>{patient.is_pregnant ? "نعم" : "لا"}</dd>
          </dl>
          {patient.notes && (
            <p className="mt-4 rounded-lg bg-canvas p-3 text-sm">{patient.notes}</p>
          )}
        </Card>

        <Card className="p-0 data-table lg:col-span-2">
          <div className="border-b border-line px-4 py-3 font-semibold">سجل الفحوصات</div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">رقم العيّنة</th>
                <th className="px-4 py-3 font-medium">الفحوصات</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">الدفع</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    لا توجد فحوصات بعد
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${o.id}`} className="font-medium text-brand-dark hover:underline">
                      {o.order_date}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{o.accession_no ?? "—"}</td>
                  <td className="px-4 py-3">{o.tests}</td>
                  <td className="px-4 py-3">{statusLabel[o.status] ?? o.status}</td>
                  <td className="px-4 py-3"><PaymentBadge status={o.payment_status} /></td>
                  <td className="px-4 py-3 tabular-nums">{money(o.total_amount)} د.ع</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
