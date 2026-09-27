import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminCookieLid } from "@/lib/license/adminCookie";
import { ADMIN_LICENSE_COOKIE } from "@/lib/license/modules";
import { licensingEnabled, recordError } from "@/lib/license/server";

/** An error seen in a browser (the admin panel or a station), kept for the owner while
 *  «سجل الأخطاء» is on. Always answers 204: a page never waits on this. */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (licensingEnabled()) {
    try {
      const b = (await req.json()) as Record<string, unknown>;
      const cookieLid = await adminCookieLid((await cookies()).get(ADMIN_LICENSE_COOKIE)?.value);
      const lid = cookieLid ?? (typeof b.lid === "string" && /^[\w-]{8,64}$/.test(b.lid) ? b.lid : null);
      await recordError({
        lid, kind: "client", path: String(b.path ?? ""), message: String(b.message ?? ""), digest: String(b.digest ?? ""),
        agent: req.headers.get("user-agent") ?? "",
      });
    } catch { /* ignore */ }
  }
  return new NextResponse(null, { status: 204 });
}
