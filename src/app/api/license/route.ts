import { NextResponse } from "next/server";
import { licensingEnabled, getContact } from "@/lib/license/server";

/** Is the lab-code system switched on, and the contact line shown on the activation / lock screens. */
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = licensingEnabled();
  const contact = enabled ? await getContact().catch(() => "") : "";
  return NextResponse.json({ enabled, contact }, { headers: { "cache-control": "no-store" } });
}
