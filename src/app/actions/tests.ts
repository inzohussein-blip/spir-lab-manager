"use server";

import { hasRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { ensureDesk } from "@/lib/desk/schema";

export async function addTest(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return; // the role's pages only (see lib/nav.ts)
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
  if (!(await hasRole("technician"))) return; // the role's pages only (see lib/nav.ts)
  const id = String(formData.get("test_id") || "");
  if (!id) return;
  const raw = formData.get("price");
  const price = raw && String(raw).trim() !== "" ? Math.max(0, Number(raw)) : 0;
  if (Number.isNaN(price)) return;
  await query(`update test_catalog set price = $1 where id = $2`, [price, id]);
  revalidatePath("/tests");
  revalidatePath("/orders/new");
}

/** «القيم الحرجة» (a result below low or above high is reported at once) and the minutes a sample
 *  with this test may take before it shows as late in «نافذة المختبر». Empty = none. */
export async function setTestLimits(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return; // the role's pages only (see lib/nav.ts)
  const id = String(formData.get("test_id") || "");
  if (!id) return;
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    const n = Number(v);
    return v !== "" && Number.isFinite(n) ? n : null;
  };
  const tat = num("tat_minutes");
  await ensureDesk();
  await query(`update test_catalog set critical_low = $1, critical_high = $2, tat_minutes = $3 where id = $4`, [
    num("critical_low"), num("critical_high"), tat == null ? null : Math.max(0, Math.round(tat)), id,
  ]);
  revalidatePath("/tests");
  revalidatePath("/lab");
}

/** The stock item a test uses and how much per test: deducted automatically when the test is ordered. */
export async function setTestReagent(formData: FormData): Promise<void> {
  if (!(await hasRole("technician"))) return; // the role's pages only (see lib/nav.ts)
  const id = String(formData.get("test_id") || "");
  if (!id) return;
  const productId = String(formData.get("product_id") || "") || null;
  const qty = Number(formData.get("qty") || 0);
  await query(`update test_catalog set reagent_product_id = $1, reagent_qty_per_test = $2 where id = $3`, [
    productId, productId && qty > 0 ? qty : null, id,
  ]);
  revalidatePath("/tests");
}
