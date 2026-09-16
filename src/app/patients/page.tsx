import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { query } from "@/lib/db";
import { PageHeader, Button, Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q || "").trim();
  const patients = await query<{
    id: string;
    full_name: string;
    gender: string | null;
    age_years: number | null;
    phone: string | null;
  }>(
    q
      ? `select id, full_name, gender, age_years, phone from patients
          where full_name ilike $1 or phone ilike $1
          order by created_at desc limit 100`
      : `select id, full_name, gender, age_years, phone from patients
          order by created_at desc limit 100`,
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

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">الجنس</th>
              <th className="px-4 py-3 font-medium">العمر</th>
              <th className="px-4 py-3 font-medium">الهاتف</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  لا يوجد مرضى مطابقون
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr
                key={p.id}
                className="border-b border-line last:border-0 hover:bg-canvas"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-brand-dark hover:underline"
                  >
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {p.gender === "male" ? "ذكر" : p.gender === "female" ? "أنثى" : "—"}
                </td>
                <td className="px-4 py-3">{p.age_years ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{p.phone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
