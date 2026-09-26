import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/** The owner's sign-in for the code manager (/licenses), with LICENSE_ADMIN_PASSWORD. */
const COOKIE = "lab_lic_owner";
const DEV_KEY = "dev-insecure-key-change-me-in-production-00000000";
const password = () => (process.env.LICENSE_ADMIN_PASSWORD ?? "").trim();
// Changing the password signs every owner session out.
const key = () => createHash("sha256").update(`lic-owner:${process.env.AUTH_SECRET || DEV_KEY}:${password()}`).digest();

export function passwordMatches(given: string): boolean {
  const p = password();
  if (!p) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(given.trim()), h(p));
}

export async function startOwnerSession(): Promise<void> {
  const token = await new SignJWT({ owner: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(key());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 3600 });
}
export function endOwnerSession(): void {
  cookies().delete(COOKIE);
}
export async function isOwner(): Promise<boolean> {
  if (!password()) return false;
  const t = cookies().get(COOKIE)?.value;
  if (!t) return false;
  try { await jwtVerify(t, key()); return true; } catch { return false; }
}

export const ipOf = (h: Headers) => (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
