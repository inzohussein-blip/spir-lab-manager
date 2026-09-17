"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";

/** Record a QC run; status auto-derived from deviation vs tolerance (Westgard-lite). */
export async function addQcRun(formData: FormData): Promise<void> {
  const controlName = String(formData.get("control_name") || "").trim();
  if (!controlName) return;
  const target = formData.get("target") ? Number(formData.get("target")) : null;
  const measured = formData.get("measured") ? Number(formData.get("measured")) : null;
  const tolerance = Number(formData.get("tolerance") || 10);

  let status = "pass";
  if (target != null && measured != null && target !== 0) {
    const devPct = (Math.abs(measured - target) / Math.abs(target)) * 100;
    if (devPct > tolerance * 1.5) status = "fail";
    else if (devPct > tolerance) status = "warn";
  }

  const user = await getCurrentUser();
  await query(
    `insert into qc_runs (control_name, analyte, target, measured, tolerance, unit, status, operator, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      controlName,
      (formData.get("analyte") as string) || null,
      target,
      measured,
      tolerance,
      (formData.get("unit") as string) || null,
      status,
      user?.full_name ?? null,
      (formData.get("notes") as string) || null,
    ]
  );
  await logAudit("qc.run", "qc", null, { control: controlName, status });
  revalidatePath("/quality");
}
