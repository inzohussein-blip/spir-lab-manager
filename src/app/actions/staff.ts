"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { hasRole } from "@/lib/auth/guard";

export async function addStaff(formData: FormData): Promise<void> {
  if (!(await hasRole())) return; // admin only
  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) return;
  await query(
    `insert into staff (full_name, role, phone) values ($1, $2, $3)`,
    [
      full_name,
      (formData.get("role") as string) || null,
      (formData.get("phone") as string) || null,
    ]
  );
  revalidatePath("/staff");
}

export async function addCoverShift(formData: FormData): Promise<void> {
  if (!(await hasRole())) return; // admin only
  const cover_date = String(formData.get("cover_date") || "");
  if (!cover_date) return;
  await query(
    `insert into cover_shifts (cover_date, original_staff_id, cover_staff_id, reason)
     values ($1, $2, $3, $4)`,
    [
      cover_date,
      (formData.get("original_staff_id") as string) || null,
      (formData.get("cover_staff_id") as string) || null,
      (formData.get("reason") as string) || null,
    ]
  );
  revalidatePath("/staff");
}
