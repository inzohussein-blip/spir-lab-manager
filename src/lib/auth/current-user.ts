import "server-only";
import { cache } from "react";
import { queryOne } from "@/lib/db";
import { getSession, type SessionUser } from "./session";

/**
 * The signed-in user as the database has them now (once per request): an account the manager
 * disabled is signed out, and a changed role or name applies at once — not when the 7-day sign-in
 * runs out. If the database cannot be read for a moment, the sign-in is taken as it is.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const s = await getSession();
  if (!s) return null;
  try {
    return await queryOne<SessionUser>(
      `select id, username, full_name, role from app_users where id = $1 and is_active`,
      [s.id]
    );
  } catch {
    return s;
  }
});

/** Verify credentials against app_users (bcrypt via pgcrypto). */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const row = await queryOne<SessionUser>(
    `select id, username, full_name, role
       from app_users
      where username = $1
        and is_active
        and password_hash = crypt($2, password_hash)`,
    [username, password]
  );
  return row;
}

export { type SessionUser };
