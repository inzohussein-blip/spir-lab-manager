import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

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

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ user })
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
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
