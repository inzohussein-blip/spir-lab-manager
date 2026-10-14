import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { labTarget } from "@/lib/db/lab";
import { mainQuery } from "@/lib/db";
import { cookieSecure } from "./cookieSecure";

/**
 * Signed session cookie. Uses AUTH_SECRET — set the SAME value here and in
 * Spir-Margin to share single sign-on across both apps.
 */

const COOKIE = "lab_session";

/** Without AUTH_SECRET (a lab's local copy, a site set up without it), sessions are signed with a
 *  random secret made once and kept in the site's database — never with a key anyone could read in
 *  the code, which would let a made-up cookie open the panel as its manager. */
let made: Promise<Uint8Array> | null = null;
async function madeSecret(): Promise<Uint8Array> {
  await mainQuery(`create table if not exists app_secrets (k text primary key, v text not null)`);
  await mainQuery(`insert into app_secrets (k, v) values ('session', $1) on conflict (k) do nothing`, [randomBytes(48).toString("base64url")]);
  const r = await mainQuery<{ v: string }>(`select v from app_secrets where k = 'session'`);
  if (!r[0]?.v) throw new Error("no session secret");
  return new TextEncoder().encode(r[0].v);
}
async function secret(): Promise<Uint8Array> {
  const s = process.env.AUTH_SECRET;
  if (s) return new TextEncoder().encode(s);
  made ??= madeSecret().catch((e) => { made = null; throw e; });
  return made;
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
    .sign(await secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: await cookieSecure(),
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
    ({ payload } = await jwtVerify(token, await secret()));
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
