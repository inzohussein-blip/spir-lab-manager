"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOffline } from "@/components/offline/OfflineProvider";
import { Button } from "@/components/ui/primitives";
import type { OutboxFields } from "@/lib/offline/outbox";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";

export function PatientForm() {
  const { submitPatient } = useOffline();
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const fields: OutboxFields = {};
    fd.forEach((v, k) => {
      fields[k] = String(v);
    });
    // Unchecked checkbox is absent from FormData — normalize.
    fields.is_pregnant = (form.elements.namedItem("is_pregnant") as HTMLInputElement)?.checked ? "on" : "";
    const name = String(fields.full_name || "").trim();
    if (!name) return;

    start(async () => {
      const r = await submitPatient(fields, `مريض: ${name}`);
      if (r.status === "synced") {
        router.push(`/patients/${r.id}`);
      } else {
        toast.info("حُفظ المريض محلياً — سيُزامن عند عودة الاتصال");
        router.push("/patients");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
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
        <Button>{pending ? "جارٍ الحفظ…" : "حفظ المريض"}</Button>
      </div>
    </form>
  );
}
