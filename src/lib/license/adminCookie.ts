import { SignJWT, jwtVerify } from "jose";
import type { LicenseModule } from "./modules";

/**
 * Cookie that lets a licensed device open the full admin panel. Issued with the device license
 * (only when the lab code includes "admin"), checked by the middleware. Edge-safe: HS256 with
 * AUTH_SECRET (the same secret as the login session).
 */
const DEV_KEY = "dev-insecure-key-change-me-in-production-00000000";
const secret = () => new TextEncoder().encode("lab-admin-license:" + (process.env.AUTH_SECRET || DEV_KEY));

/** Cookies last at most a week, so a stopped code or removed panel takes effect soon. */
export const ADMIN_COOKIE_MAX_MS = 7 * 86_400_000;

export async function signAdminCookie(v: { lid: string; mods: LicenseModule[]; until: number }): Promise<string> {
  return new SignJWT({ lid: v.lid, mods: v.mods, until: v.until })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Math.min(v.until, Date.now() + ADMIN_COOKIE_MAX_MS) / 1000))
    .sign(secret());
}

/** True when the cookie is genuine, unexpired and grants the admin panel. */
export async function adminCookieValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return Array.isArray(payload.mods) && payload.mods.includes("admin") && Number(payload.until) > Date.now();
  } catch {
    return false;
  }
}
