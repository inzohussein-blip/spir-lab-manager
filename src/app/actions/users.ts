"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";

const ROLES = ["admin", "technician", "reception"];

async function requireAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return u?.role === "admin";
}

export async function createUser(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const full_name = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "technician");
  if (!username || !password || !full_name || !ROLES.includes(role)) return;
  await query(
    `insert into app_users (username, password_hash, full_name, role)
     values ($1, crypt($2, gen_salt('bf')), $3, $4)
     on conflict (username) do nothing`,
    [username, password, full_name, role]
  );
  await logAudit("user.created", "user", null, { username, role });
  revalidatePath("/users");
}

export async function setUserRole(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "");
  if (!id || !ROLES.includes(role)) return;
  await query(`update app_users set role = $1 where id = $2`, [role, id]);
  await logAudit("user.role", "user", id, { role });
  revalidatePath("/users");
}

export async function setUserActive(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("user_id") || "");
  const active = formData.get("active") === "1";
  if (!id) return;
  await query(`update app_users set is_active = $1 where id = $2`, [active, id]);
  revalidatePath("/users");
}
