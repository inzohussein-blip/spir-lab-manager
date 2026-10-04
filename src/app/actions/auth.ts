"use server";

import { verifyCredentials } from "@/lib/auth/current-user";
import { createSession, destroySession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { labTarget } from "@/lib/db/lab";
import { homeFor } from "@/lib/nav";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; to?: string; username?: string }> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  // The username comes back with an error, so the form keeps it (it is reset after each try).
  if (!username || !password) {
    return { error: "يرجى إدخال اسم المستخدم وكلمة المرور", username };
  }
  const user = await verifyCredentials(username, password);
  if (!user) {
    return { error: "بيانات الدخول غير صحيحة", username };
  }
  await createSession(user);
  // The page opens the panel with a full load (its frame differs from the sign-in page's).
  return { to: homeFor(user.role) };
}

/** Sign out; the page then loads the sign-in page afresh. */
export async function logoutAction(): Promise<void> {
  await destroySession();
}

/** A lab's own database (or its section of the site's) with no accounts yet: the lab creates its
 *  first admin at the sign-in page. Only for a device whose lab code opens the panel. */
export async function firstRunNeeded(): Promise<boolean> {
  try {
    const t = await labTarget();
    if (!t?.where) return false;
    return (await queryOne<{ n: number }>(`select count(*)::int as n from app_users`))?.n === 0;
  } catch {
    return false;
  }
}

export async function firstRunAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; to?: string; username?: string; full_name?: string }> {
  const username = String(formData.get("username") || "").trim();
  const full_name = String(formData.get("full_name") || "").trim().slice(0, 80) || "مدير المختبر";
  const password = String(formData.get("password") || "");
  if (password !== String(formData.get("again") || "")) return { error: "كلمتا المرور غير متطابقتين", username, full_name };
  if (!/^[\p{L}\p{N}._-]{2,40}$/u.test(username) || password.length < 6) {
    return { error: "اسم المستخدم (حرفان على الأقل، بلا مسافات) وكلمة المرور (6 أحرف على الأقل)", username, full_name };
  }
  if (!(await firstRunNeeded())) return { error: "هذه القاعدة فيها حسابات — سجّل الدخول", username, full_name };
  const user = await queryOne<{ id: string; username: string; full_name: string; role: string }>(
    `insert into app_users (username, password_hash, full_name, role)
     select $1, crypt($2, gen_salt('bf')), $3, 'admin'
      where not exists (select 1 from app_users)
     returning id, username, full_name, role`,
    [username, password, full_name]
  );
  if (!user) return { error: "هذه القاعدة فيها حسابات — سجّل الدخول", username, full_name };
  await createSession(user);
  return { to: "/" };
}
