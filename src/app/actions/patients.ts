"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function createPatient(formData: FormData): Promise<void> {
  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) return;
  const rows = await query<{ id: string }>(
    `insert into patients
       (full_name, gender, age_years, phone, chronic_diseases, current_meds, is_pregnant, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      full_name,
      (formData.get("gender") as string) || null,
      formData.get("age_years") ? Number(formData.get("age_years")) : null,
      (formData.get("phone") as string) || null,
      (formData.get("chronic_diseases") as string) || null,
      (formData.get("current_meds") as string) || null,
      formData.get("is_pregnant") === "on",
      (formData.get("notes") as string) || null,
    ]
  );
  await logAudit("patient.created", "patient", rows[0].id, { name: full_name });
  revalidatePath("/patients");
  redirect(`/patients/${rows[0].id}`);
}
