import "server-only";
import { NextResponse } from "next/server";
import { signRefusal, type DeviceResult } from "@/lib/license/server";
import { signAdminCookie, ADMIN_COOKIE_MAX_MS } from "@/lib/license/adminCookie";
import { ADMIN_LICENSE_COOKIE } from "@/lib/license/modules";
import { cookieSecure } from "@/lib/auth/cookieSecure";

/** Device reply: the signed license, and the admin-panel cookie when the code includes it. A refusal
 *  to a known device (`who`) carries a proof signed with the licenses' key — the device locks only on that. */
export async function deviceReply(r: DeviceResult, status = 200, who?: { lid: string; dev: string }) {
  const proof = !r.ok && who ? await signRefusal(who.lid, who.dev, r.error) : null;
  const body = r.ok
    ? { ok: true, token: r.token, pub: r.pub, now: Date.now(), message: r.row.message || "", sync: r.sync, pin: r.row.pin ?? null, pins: r.row.pinPolicy ?? null }
    : { ok: false, error: r.error, lab: r.row?.lab_name, until: r.row?.expires_at ?? null, now: Date.now(), ...(proof ? { proof } : {}) };
  const res = NextResponse.json(body, { status: r.ok ? status : r.error === "not_found" ? 404 : 403, headers: { "cache-control": "no-store" } });
  if (r.ok && r.row.modules.includes("admin")) {
    const until = r.row.expires_at!;
    res.cookies.set(ADMIN_LICENSE_COOKIE, await signAdminCookie({ lid: r.row.id, mods: r.row.modules, until }), {
      httpOnly: true, sameSite: "lax", secure: await cookieSecure(), path: "/",
      maxAge: Math.max(1, Math.floor(Math.min(until - Date.now(), ADMIN_COOKIE_MAX_MS) / 1000)),
    });
  } else {
    res.cookies.delete(ADMIN_LICENSE_COOKIE);
  }
  return res;
}
