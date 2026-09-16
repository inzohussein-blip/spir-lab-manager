import { createPatient } from "@/app/actions/patients";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

const field =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export default function NewPatientPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة مريض جديد" subtitle="القسم 1 — النتائج والمرضى" />
      <Card>
        <form action={createPatient} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">
            الاسم الثلاثي *
            <input name="full_name" required className={field} />
          </label>

          <label className="text-sm font-medium">
            الجنس
            <select name="gender" className={field} defaultValue="">
              <option value="">—</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            العمر
            <input name="age_years" type="number" min="0" className={field} />
          </label>

          <label className="text-sm font-medium">
            رقم الهاتف
            <input name="phone" className={field} />
          </label>

          <label className="flex items-center gap-2 self-end text-sm font-medium">
            <input name="is_pregnant" type="checkbox" className="size-4" />
            حالة الحمل
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            أمراض مزمنة
            <input name="chronic_diseases" className={field} />
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            أدوية حالية
            <input name="current_meds" className={field} />
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            ملاحظات طبية
            <textarea name="notes" rows={3} className={field} />
          </label>

          <div className="sm:col-span-2">
            <Button>حفظ المريض</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
