import { notFound } from "next/navigation";
import { UserRound, Search, UserPlus } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { PageHeader, Card, EmptyState, Button } from "@/components/ui/primitives";
import { OrderForm } from "@/components/OrderForm";
import { PatientPicker, type PickPatient } from "@/components/PatientPicker";

export const dynamic = "force-dynamic";

type Patient = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  birth_date: string | null;
  phone: string | null;
  is_pregnant: boolean;
};

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: { patient?: string };
}) {
  const patientId = searchParams.patient;

  // ── Step 0: pick a patient when none is passed ──────────────────────────────
  if (!patientId) {
    const patients = await query<PickPatient>(
      `select p.id, p.full_name, p.gender, p.age_years, p.phone,
              count(o.id)::int as visits,
              to_char(max(o.order_date), 'YYYY-MM-DD') as last_visit
         from patients p
         left join test_orders o on o.patient_id = p.id
        group by p.id
        order by max(o.order_date) desc nulls last, p.created_at desc
        limit 300`
    );
    return (
      <div className="max-w-lg">
        <PageHeader
          title="طلب فحص جديد"
          subtitle="اختر المريض أولاً لبدء الطلب"
          action={
            <Button href="/patients/new">
              <UserPlus className="size-4" /> تسجيل مريض جديد
            </Button>
          }
        />
        <Card className={patients.length ? "p-3" : ""}>
          {patients.length === 0 ? (
            <EmptyState
              icon={<UserRound className="size-6" />}
              title="لا يوجد مرضى مسجّلون بعد"
              hint="سجّل مريضاً جديداً أولاً ثم أنشئ له طلب الفحص."
              action={<Button href="/patients/new">تسجيل مريض جديد</Button>}
            />
          ) : (
            <PatientPicker patients={patients} />
          )}
        </Card>
      </div>
    );
  }

  const patient = await queryOne<Patient>(
    `select id, full_name, gender, age_years, birth_date, phone, is_pregnant
       from patients where id = $1`,
    [patientId]
  );
  if (!patient) notFound();

  const [tests, referrers] = await Promise.all([
    query<{
      id: string;
      name_ar: string;
      name_en: string | null;
      category: string | null;
      price: number;
    }>(
      `select id, name_ar, name_en, category, price from test_catalog
        where is_active order by category nulls last, name_ar`
    ),
    query<{ id: string; name: string; clinic: string | null }>(
      `select id, name, clinic from referrers order by name`
    ),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="طلب فحص جديد — الاستقبال"
        subtitle="اختر مصدر التحويل والفحوصات المطلوبة وسجّل الدفع"
        action={
          <Button href={`/patients/${patient.id}`} variant="ghost">
            <Search className="size-4" /> ملف المريض
          </Button>
        }
      />
      <OrderForm patient={patient} tests={tests} referrers={referrers} />
    </div>
  );
}
