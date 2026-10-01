"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { isDay } from "@/lib/finance";

/** «إغلاق الصندوق»: the cash counted in the drawer for a day (closing again replaces it). */
export async function closeDay(formData: FormData): Promise<void> {
  const day = String(formData.get("day") || "");
  if (!isDay(day)) return;
  const counted = Number(String(formData.get("counted") || "0").replace(/[^\d.-]/g, "")) || 0;
  const expected = Number(formData.get("expected") || 0) || 0;
  const notes = String(formData.get("notes") || "").trim() || null;
  const user = await getSession();
  await query(
    `insert into cash_closings (day, expected, counted, notes, closed_by, closed_at)
     values ($1::date, $2, $3, $4, $5, now())
     on conflict (day) do update set expected = excluded.expected, counted = excluded.counted, notes = excluded.notes,
       closed_by = excluded.closed_by, closed_at = now()`,
    [day, expected, counted, notes, user?.id ?? null]
  );
  await logAudit("cash.closed", "cash_closing", null, { day, expected, counted });
  revalidatePath("/cashbox");
}

/** Re-open a closed day (its closing is removed; the records are untouched). */
export async function reopenDay(formData: FormData): Promise<void> {
  const day = String(formData.get("day") || "");
  if (!isDay(day)) return;
  await query(`delete from cash_closings where day = $1::date`, [day]);
  await logAudit("cash.reopened", "cash_closing", null, { day });
  revalidatePath("/cashbox");
}

/** A referring doctor's share (percent of what their referrals were billed). */
export async function setCommission(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const pct = Math.max(0, Math.min(100, Number(formData.get("commission_pct") || 0) || 0));
  if (!id) return;
  await query(`update referrers set commission_pct = $1 where id = $2`, [pct, id]);
  await logAudit("referrer.commission", "referrer", id, { pct });
  revalidatePath("/referrers");
  revalidatePath("/referrers/commissions");
}
