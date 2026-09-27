"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";
import { saveLabIdentity, saveLabLogo, saveReportImage, saveReportLook } from "@/lib/lab-identity";

/** Save the lab's name and the letterhead lines printed on reports and receipts (admin only). */
export async function updateLabIdentity(formData: FormData): Promise<void> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return;
  const name = String(formData.get("name") || "");
  const subtitle = String(formData.get("subtitle") || "");
  const footer = String(formData.get("footer") || "");
  await saveLabIdentity({ name, subtitle, footer });
  await logAudit("settings.letterhead", "settings", null, { name, subtitle, footer });
  revalidatePath("/", "layout");
}

/** Set the lab's logo (an image data URL, already made small in the browser), or remove it (""). */
export async function updateLabLogo(dataUrl: string): Promise<{ ok: boolean; error?: string }> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return { ok: false, error: "forbidden" };
  if (!(await saveLabLogo(String(dataUrl ?? "")))) return { ok: false, error: "bad_image" };
  await logAudit("settings.logo", "settings", null, { removed: !dataUrl });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The report's colours, signature details and English letterhead (admin only). */
export async function updateReportLook(v: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return { ok: false, error: "forbidden" };
  const saved = await saveReportLook(v && typeof v === "object" ? v : {});
  await logAudit("settings.report_look", "settings", null, { primary: saved.primary, accent: saved.accent, intensity: saved.intensity, signatureOn: saved.signatureOn, lang: saved.lang });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The signature or stamp image on the report (already made small in the browser), or "" to remove it. */
export async function updateReportImage(kind: string, dataUrl: string): Promise<{ ok: boolean; error?: string }> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return { ok: false, error: "forbidden" };
  if (kind !== "signature" && kind !== "stamp") return { ok: false, error: "bad_kind" };
  if (!(await saveReportImage(kind, String(dataUrl ?? "")))) return { ok: false, error: "bad_image" };
  await logAudit(`settings.report_${kind}`, "settings", null, { removed: !dataUrl });
  revalidatePath("/", "layout");
  return { ok: true };
}
