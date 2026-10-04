import { query } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
import { DoctorCodes } from "@/components/desk/DoctorCodes";
import { ensureOps } from "@/lib/desk/schema";
import { doctorsOn } from "@/lib/doctors/server";

export const dynamic = "force-dynamic";

/** «رموز الأطباء»: a code per referring doctor; his verified results reach «نافذة الأطباء». */
export default async function DoctorCodesPage() {
  await ensureOps();
  const [rows, on] = await Promise.all([
    query<any>(
      `select r.id, r.name, c.id as code_id, c.win, c.hide_phone, c.last_at::text as last_at, c.last_error,
              (select count(*)::int from test_orders o where o.referrer_id = r.id and o.status in ('completed', 'delivered')) as done
         from referrers r left join doctor_codes c on c.referrer_id = r.id order by r.name`
    ),
    doctorsOn().catch(() => false),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="رموز الأطباء" subtitle="لكل طبيب محيل رمز يفتح به «نافذة الأطباء» فيرى نتائج مراجعيه المعتمدة — تُحدَّث تلقائياً عند كل اعتماد وتسليم." />
      <DoctorCodes on={on} rows={rows.map((r) => ({
        id: r.id, name: r.name, done: r.done, codeId: r.code_id ?? null, win: r.win ?? "month", hidePhone: !!r.hide_phone,
        lastAt: r.last_at ?? null, lastError: r.last_error ?? null,
      }))} />
    </div>
  );
}
