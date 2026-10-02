import { NextResponse, type NextRequest } from "next/server";
import {
  connectInfo, whoIs, roomSend, roomPoll, mailRegister, mailSend, mailFetch, mailAck, publicSend, publicPoll,
} from "@/lib/connect/server";

/** «محطة التواصل» (lib/connect/server): sealed messages for the lab's internal chat and the
 *  mailbox between labs, and «المحادثة العامة». */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  try { return json({ ok: true, ...(await connectInfo()) }); } catch { return json({ ok: false, error: "unreachable" }, 502); }
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const op = String(b.op ?? "");
  try {
    const info = await connectInfo();
    const room = op === "room_send" || op === "room_poll";
    const mail = op.startsWith("mail_");
    const pub = op.startsWith("public_");
    if (!room && !mail && !pub) return json({ ok: false, error: "bad_request" }, 400);
    if ((room && !info.room) || (mail && !info.relay) || (pub && !info.public)) return json({ ok: false, error: "off" }, 403);
    const who = await whoIs(b, mail || pub);
    if (!who.ok) return json({ ok: false, error: who.error }, who.status);
    let r: { ok: boolean; error?: string };
    if (op === "room_send") r = await roomSend(who.scope, b.tag, b.box);
    else if (op === "room_poll") r = await roomPoll(who.scope, b.tag, b.since, { dev: b.device ?? b.dev, box: b.me });
    else if (op === "mail_register") r = await mailRegister(who.lid, b.pub);
    else if (op === "mail_send") r = await mailSend(b.to, b.from, b.box);
    else if (op === "mail_fetch") r = await mailFetch(who.lid, b.addr);
    else if (op === "mail_ack") r = await mailAck(who.lid, b.addr, b.ids);
    else if (op === "public_send") r = await publicSend(who, b);
    else if (op === "public_poll") r = await publicPoll(who.lid, b.since);
    else return json({ ok: false, error: "bad_request" }, 400);
    return json(r, r.ok ? 200 : r.error === "too_fast" ? 429 : 400);
  } catch {
    return json({ ok: false, error: "unreachable" }, 502);
  }
}
