import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * One-time activation of the local stations on a new device.
 * The code lives only in the server environment (STATION_ACTIVATION_CODE) — it is
 * never sent to the browser. An optional STATION_ACTIVATION_CONTACT line is shown
 * in the activation window. With no code configured, activation is switched off.
 */
export const dynamic = "force-dynamic";

const code = () => (process.env.STATION_ACTIVATION_CODE ?? "").trim();
const contact = () => (process.env.STATION_ACTIVATION_CONTACT ?? "").trim();

// Best-effort brake on guessing (per server instance): 10 wrong tries per 10 minutes per address.
const fails = new Map<string, { n: number; since: number }>();
const WINDOW = 10 * 60 * 1000, MAX_FAILS = 10;
const ipOf = (req: NextRequest) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";

const same = (a: string, b: string) => {
  const h = (s: string) => createHash("sha256").update(s).digest(); // equal length for timingSafeEqual
  return timingSafeEqual(h(a), h(b));
};

/** Is activation switched on, and the contact line to show. */
export function GET() {
  return NextResponse.json({ enabled: !!code(), contact: contact() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const secret = code();
  if (!secret) return NextResponse.json({ ok: true, enabled: false }, { headers: { "cache-control": "no-store" } });

  const ip = ipOf(req);
  const now = Date.now();
  const f = fails.get(ip);
  if (f && now - f.since < WINDOW && f.n >= MAX_FAILS) {
    return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });
  }

  let given = "";
  try { given = String((await req.json())?.code ?? "").trim(); } catch { /* empty */ }
  if (given && same(given, secret)) {
    fails.delete(ip);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  }

  const cur = f && now - f.since < WINDOW ? f : { n: 0, since: now };
  fails.set(ip, { n: cur.n + 1, since: cur.since });
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  return NextResponse.json({ ok: false }, { status: 401 });
}
