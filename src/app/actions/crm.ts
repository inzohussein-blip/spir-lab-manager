"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function addReferrer(formData: FormData): Promise<void> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await query(
    `insert into referrers (name, clinic, phone) values ($1, $2, $3)`,
    [name, (formData.get("clinic") as string) || null, (formData.get("phone") as string) || null]
  );
  revalidatePath("/referrers");
}

export async function createAppointment(formData: FormData): Promise<void> {
  const scheduledAt = String(formData.get("scheduled_at") || "");
  const patientId = (formData.get("patient_id") as string) || null;
  const patientName = (formData.get("patient_name") as string) || null;
  if (!scheduledAt || (!patientId && !patientName)) return;
  await query(
    `insert into appointments (patient_id, patient_name, referrer_id, scheduled_at, purpose)
     values ($1, $2, $3, $4, $5)`,
    [
      patientId,
      patientName,
      (formData.get("referrer_id") as string) || null,
      scheduledAt,
      (formData.get("purpose") as string) || null,
    ]
  );
  await logAudit("appointment.created", "appointment", null, { scheduledAt });
  revalidatePath("/appointments");
}

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("appointment_id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !status) return;
  await query(`update appointments set status = $1 where id = $2`, [status, id]);
  revalidatePath("/appointments");
}
