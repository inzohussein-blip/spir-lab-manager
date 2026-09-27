"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";
import { saveLabIdentity, saveLabLogo } from "@/lib/lab-identity";

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
