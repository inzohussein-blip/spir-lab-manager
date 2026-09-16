"use server";

import { redirect } from "next/navigation";
import { verifyCredentials } from "@/lib/auth/current-user";
import { createSession, destroySession } from "@/lib/auth/session";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) {
    return { error: "يرجى إدخال اسم المستخدم وكلمة المرور" };
  }
  const user = await verifyCredentials(username, password);
  if (!user) {
    return { error: "بيانات الدخول غير صحيحة" };
  }
  await createSession(user);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  destroySession();
  redirect("/login");
}
