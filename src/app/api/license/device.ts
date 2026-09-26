import "server-only";
import { NextResponse } from "next/server";
import type { DeviceResult } from "@/lib/license/server";
import { signAdminCookie, ADMIN_COOKIE_MAX_MS } from "@/lib/license/adminCookie";
import { ADMIN_LICENSE_COOKIE } from "@/lib/license/modules";

/** Device reply: the signed license, and the admin-panel cookie when the code includes it. */
export async function deviceReply(r: DeviceResult, status = 200) {
  const body = r.ok
    ? { ok: true, token: r.token, pub: r.pub, now: Date.now(), message: r.row.message || "" }
    : { ok: false, error: r.error, lab: r.row?.lab_name, until: r.row?.expires_at ?? null, now: Date.now() };
  const res = NextResponse.json(body, { status: r.ok ? status : r.error === "not_found" ? 404 : 403, headers: { "cache-control": "no-store" } });
  if (r.ok && r.row.modules.includes("admin")) {
    const until = r.row.expires_at!;
    res.cookies.set(ADMIN_LICENSE_COOKIE, await signAdminCookie({ lid: r.row.id, mods: r.row.modules, until }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      maxAge: Math.max(1, Math.floor(Math.min(until - Date.now(), ADMIN_COOKIE_MAX_MS) / 1000)),
    });
  } else {
    res.cookies.delete(ADMIN_LICENSE_COOKIE);
  }
  return res;
}
