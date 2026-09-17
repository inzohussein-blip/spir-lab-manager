import "server-only";
import { getCurrentUser } from "./current-user";

/**
 * Lightweight role gate for server actions. This app serves a single private
 * lab, so the model is simple: admins can do everything; other roles are
 * limited to their desk. Returns true when the current user may proceed.
 */
export async function hasRole(...roles: string[]): Promise<boolean> {
  const u = await getCurrentUser();
  if (!u) return false;
  if (u.role === "admin") return true;
  return roles.includes(u.role);
}
