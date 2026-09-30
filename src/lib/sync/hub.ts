import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { licensingEnabled } from "@/lib/license/env";

/**
 * «خادم الشبكة المحلية»: the lab runs this app on one of its own computers (no internet needed)
 * with LAN_HUB_KEY set. Its other computers open the app from it and sync through it with that
 * key. Only on a server without lab codes (a lab's own installation): the hosted site never
 * serves as a hub.
 */
const key = () => (process.env.LAN_HUB_KEY ?? "").trim();
export const hubOn = () => key().length >= 8 && !licensingEnabled();
const digest = (s: string) => createHash("sha256").update(s).digest();
export function hubKeyMatches(v: unknown): boolean {
  if (!hubOn() || typeof v !== "string" || !v) return false;
  return timingSafeEqual(digest(v), digest(key()));
}
