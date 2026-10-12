import { headers } from "next/headers";

/**
 * Whether the sign-in cookies are marked Secure (sent only over https). Always in production —
 * except in the lab's local copy (scripts/local/start-lab, which sets LAB_LOCAL_HTTP=1), where the
 * lab's other computers reach it at http://192.168.…: a Secure cookie would be dropped there and
 * nobody could sign in. Even then a request that came over https keeps the Secure mark.
 */
export async function cookieSecure(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.LAB_LOCAL_HTTP !== "1") return true;
  const proto = ((await headers()).get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  return proto === "https";
}
