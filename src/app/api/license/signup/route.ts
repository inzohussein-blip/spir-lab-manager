import { NextResponse, type NextRequest } from "next/server";
import { attemptsBlocked, createLicense, getPrefs, licensingEnabled, noteAttempt } from "@/lib/license/server";
import { ipOf } from "@/lib/license/owner";

/**
 * «التسجيل الذاتي»: a lab registers itself and gets a trial code at once (only while the owner has
 * it on in /licenses → الإعدادات العامة). The code shows in the owner's list as «تسجيل ذاتي».
 */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return json({ ok: false, error: "disabled" }, 400);
  const prefs = await getPrefs().catch(() => null);
  if (!prefs?.selfSignup) return json({ ok: false, error: "closed" }, 403);
  const ip = ipOf(req.headers);
  // A few registrations per address in 10 minutes.
  if (await attemptsBlocked("signup", ip, 3)) return json({ ok: false, error: "too_many" }, 429);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const lab = String(b.lab ?? "").trim().slice(0, 120);
  const phone = String(b.phone ?? "").replace(/[^\d+]/g, "").slice(0, 20);
  const city = String(b.city ?? "").trim().slice(0, 60);
  if (lab.length < 2 || phone.length < 7) return json({ ok: false, error: "bad_request" }, 400);
  await noteAttempt("signup", ip);
  const { row, code } = await createLicense({
    lab, days: prefs.trialDays, modules: prefs.defaultModules, trial: true, source: "signup",
    note: [phone, city].filter(Boolean).join(" — "),
  });
  return json({ ok: true, code, days: row.duration_days });
}
