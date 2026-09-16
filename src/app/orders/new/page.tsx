import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { createOrder } from "@/app/actions/orders";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: { patient?: string };
}) {
  const patientId = searchParams.patient;
  if (!patientId) {
    // No patient chosen — send the user to pick one.
    const patients = await query<{ id: string; full_name: string }>(
      `select id, full_name from patients order by created_at desc limit 50`
    );
    return (
      <div className="max-w-lg">
        <PageHeader title="طلب فحص جديد" subtitle="اختر المريض أولاً" />
        <Card>
          <ul className="flex flex-col gap-1 text-sm">
            {patients.map((p) => (
              <li key={p.id}>
                <a
                  href={`/orders/new?patient=${p.id}`}
                  className="block rounded-lg px-3 py-2 hover:bg-canvas"
                >
                  {p.full_name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  const patient = await queryOne<{ full_name: string }>(
    `select full_name from patients where id = $1`,
    [patientId]
  );
  if (!patient) notFound();

  const tests = await query<{
    id: string;
    name_ar: string;
    category: string | null;
    price: number;
  }>(
    `select id, name_ar, category, price from test_catalog
      where is_active order by category, name_ar`
  );

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="طلب فحص جديد"
        subtitle={`المريض: ${patient.full_name}`}
      />
      <Card>
        <form action={createOrder} className="flex flex-col gap-4">
          <input type="hidden" name="patient_id" value={patientId} />
          <div className="text-sm font-medium">اختر الفحوصات المطلوبة:</div>
          <div className="grid gap-1 sm:grid-cols-2">
            {tests.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"
              >
                <input type="checkbox" name="test_ids" value={t.id} className="size-4" />
                <span className="flex-1">{t.name_ar}</span>
                <span className="text-muted">{t.price}</span>
              </label>
            ))}
          </div>
          <Button>إنشاء الطلب</Button>
        </form>
      </Card>
    </div>
  );
}
