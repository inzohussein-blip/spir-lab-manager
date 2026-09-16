import "server-only";
import { queryOne } from "@/lib/db";
import { getSession, type SessionUser } from "./session";

export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSession();
}

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
