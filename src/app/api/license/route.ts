import { NextResponse } from "next/server";
import { licensingEnabled, getContact, getPrefs } from "@/lib/license/server";

/** Is the lab-code system switched on, the contact line shown on the activation / lock screens,
 *  and whether a lab may register itself (/signup). */
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = licensingEnabled();
  const contact = enabled ? await getContact().catch(() => "") : "";
  const signup = enabled ? await getPrefs().then((p) => p.selfSignup).catch(() => false) : false;
  return NextResponse.json({ enabled, contact, signup }, { headers: { "cache-control": "no-store" } });
}
