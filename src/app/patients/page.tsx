import Link from "next/link";
import { Plus, Search, UserRound, ClipboardPlus, Users } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Button, Card, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  phone: string | null;
  visits: number;
  last_visit: string | null;
};

function GenderChip({ gender }: { gender: string | null }) {
  if (gender === "male")
    return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">ذكر</span>;
  if (gender === "female")
    return <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-600">أنثى</span>;
  return <span className="text-muted">—</span>;
}

export default async function PatientsPage(
  props: {
    searchParams: Promise<{ q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q || "").trim();
  const patients = await query<Row>(
    `select p.id, p.full_name, p.gender, p.age_years, p.phone,
            count(o.id)::int as visits,
            to_char(max(o.order_date), 'YYYY-MM-DD') as last_visit
       from patients p
       left join test_orders o on o.patient_id = p.id
      ${q ? "where p.full_name ilike $1 or p.phone ilike $1" : ""}
      group by p.id
      order by max(o.order_date) desc nulls last, p.created_at desc
      limit 100`,
    q ? [`%${q}%`] : []
  );

  return (
    <div>
      <PageHeader
        title="المرضى"
        subtitle="سجل المرضى والبحث السريع"
        action={
          <Button href="/patients/new">
            <Plus className="size-4" /> مريض جديد
          </Button>
        }
      />

      <form className="mb-4 flex max-w-md items-center gap-2 rounded-lg border border-line bg-surface px-3">
        <Search className="size-4 text-muted" />
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث بالاسم أو رقم الهاتف…"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </form>

      <Card className="p-0 data-table">
        {patients.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={q ? "لا يوجد مرضى مطابقون" : "لا يوجد مرضى بعد"}
            hint={q ? "جرّب اسماً أو رقم هاتف آخر." : "ابدأ بتسجيل أول مريض في المختبر."}
            action={!q && <Button href="/patients/new">تسجيل مريض جديد</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-right text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">الجنس</th>
                <th className="px-4 py-3 font-medium">العمر</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">الزيارات</th>
                <th className="px-4 py-3 font-medium">آخر زيارة</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
                        {p.full_name?.trim()?.[0] ?? <UserRound className="size-4" />}
                      </span>
                      <span className="font-medium text-brand-dark hover:underline">{p.full_name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><GenderChip gender={p.gender} /></td>
                  <td className="px-4 py-3">{p.age_years ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{p.phone ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{p.visits}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{p.last_visit ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/new?patient=${p.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs hover:bg-canvas"
                    >
                      <ClipboardPlus className="size-3.5" /> طلب فحص
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
