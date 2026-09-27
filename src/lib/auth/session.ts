import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { labTarget } from "@/lib/db/lab";

/**
 * Signed session cookie. Uses AUTH_SECRET — set the SAME value here and in
 * Spir-Margin to share single sign-on across both apps.
 */

const COOKIE = "lab_session";
const DEV_KEY = "dev-insecure-key-change-me-in-production-00000000";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || DEV_KEY;
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
}

/** Which database the account belongs to: a lab's own (see lib/db/lab.ts) or the site's. */
async function dbKey(): Promise<string> {
  return (await labTarget())?.key ?? "main";
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ user, db: await dbKey() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret()));
  } catch {
    return null;
  }
  // A sign-in made on another database (the lab's was set or changed) is not valid here.
  if ((typeof payload.db === "string" ? payload.db : "main") !== (await dbKey())) return null;
  return (payload.user as SessionUser) ?? null;
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
