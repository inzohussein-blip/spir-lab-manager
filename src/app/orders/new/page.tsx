import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/primitives";
import { OrderForm } from "@/components/OrderForm";

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

  const [tests, referrers] = await Promise.all([
    query<{
      id: string;
      name_ar: string;
      category: string | null;
      price: number;
    }>(
      `select id, name_ar, category, price from test_catalog
        where is_active order by category, name_ar`
    ),
    query<any>(`select id, name from referrers order by name`),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="طلب فحص جديد"
        subtitle={`المريض: ${patient.full_name}`}
      />
      <Card>
        <OrderForm patientId={patientId} tests={tests} referrers={referrers} />
      </Card>
    </div>
  );
}
