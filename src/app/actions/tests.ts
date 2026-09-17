"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

export async function addTest(formData: FormData): Promise<void> {
  const name_ar = String(formData.get("name_ar") || "").trim();
  if (!name_ar) return;
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== "" ? Number(v) : null;
  };
  await query(
    `insert into test_catalog
       (code, name_ar, name_en, category, sample_type, unit,
        normal_low, normal_high, price, is_special)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      (formData.get("code") as string) || null,
      name_ar,
      (formData.get("name_en") as string) || null,
      (formData.get("category") as string) || null,
      (formData.get("sample_type") as string) || null,
      (formData.get("unit") as string) || null,
      num("normal_low"),
      num("normal_high"),
      Number(formData.get("price") || 0),
      formData.get("is_special") === "on",
    ]
  );
  revalidatePath("/tests");
}

/** Set (or clear) a test's price. An empty value means "unpriced" (stored as
 *  0), so a lab can keep some tests without a set price. */
export async function setTestPrice(formData: FormData): Promise<void> {
  const id = String(formData.get("test_id") || "");
  if (!id) return;
  const raw = formData.get("price");
  const price = raw && String(raw).trim() !== "" ? Math.max(0, Number(raw)) : 0;
  if (Number.isNaN(price)) return;
  await query(`update test_catalog set price = $1 where id = $2`, [price, id]);
  revalidatePath("/tests");
  revalidatePath("/orders/new");
}
