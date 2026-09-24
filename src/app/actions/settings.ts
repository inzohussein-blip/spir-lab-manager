"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";
import { saveLabIdentity } from "@/lib/lab-identity";

/** Save the letterhead lines printed on reports and receipts (admin only). */
export async function updateLabIdentity(formData: FormData): Promise<void> {
  const u = await getCurrentUser();
  if (u?.role !== "admin") return;
  const subtitle = String(formData.get("subtitle") || "");
  const footer = String(formData.get("footer") || "");
  await saveLabIdentity({ subtitle, footer });
  await logAudit("settings.letterhead", "settings", null, { subtitle, footer });
  revalidatePath("/settings");
}
