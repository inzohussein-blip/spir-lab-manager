"use client";

/**
 * «محطة التواصل» — talking to the server (lib/connect/server) and to other computers directly
 * (lib/connect/direct). A poller runs while the station is open: the internal chat every few
 * seconds, the public chat and the mailbox a little less often.
 */
import { useEffect, useState } from "react";
import { licenseProof, deviceId } from "@/lib/license/client";
import { sealRoom, openRoom, sealFor, openFrom, addressOf } from "./crypto";
import {
  getSettings, identity, myCard, myAddress, contactById, contactByPub, addContact, addMessages, messages, newOutgoing, setStatus,
  readCursors, writeCursors, pruneOld, removeMessages, CONNECT_EVENT, type Msg,
} from "./store";
import { directSend, isConnected } from "./direct";

export interface ServerInfo { licensing: boolean; room: boolean; relay: boolean; public: boolean }
export interface NetState {
  info: ServerInfo | null;
  /** The lab's computers in the internal chat now (names), and this computer among them. */
  online: { name: string; me: boolean }[];
  roomError: string; publicError: string; mailError: string;
}
const net: NetState = { info: null, online: [], roomError: "", publicError: "", mailError: "" };
const emit = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(CONNECT_EVENT)); };
const setNet = (p: Partial<NetState>) => { Object.assign(net, p); emit(); };
export function useNet(): NetState {
  const [, setN] = useState(0);
  useEffect(() => {
    const up = () => setN((x) => x + 1);
    window.addEventListener(CONNECT_EVENT, up);
    return () => window.removeEventListener(CONNECT_EVENT, up);
  }, []);
  return net;
}

// ── The server ───────────────────────────────────────────────────────────────
let infoAt = 0;
export async function serverInfo(force = false): Promise<ServerInfo | null> {
  if (!force && net.info && Date.now() - infoAt < 5 * 60_000) return net.info;
  try {
    const d = await (await fetch("/api/connect", { cache: "no-store" })).json();
    if (d?.ok) { infoAt = Date.now(); setNet({ info: { licensing: !!d.licensing, room: !!d.room, relay: !!d.relay, public: !!d.public } }); }
  } catch { /* offline: keep the last answer */ }
  return net.info;
}
async function call(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  try {
    const p = await licenseProof();
    const r = await fetch("/api/connect", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, ...(p ? { token: p.token, device: p.device } : { dev: deviceId() }) }),
    });
    const d = await r.json().catch(() => null);
    return d && typeof d === "object" ? d : { ok: false, error: "unreachable" };
  } catch { return { ok: false, error: "offline" }; }
}
export const ERRORS: Record<string, string> = {
  offline: "لا اتصال بالخادم الآن — تُرسل الرسائل عند عودته.",
  unreachable: "الخادم لا يرد الآن — تُرسل الرسائل عند عودته.",
  off: "أوقف المزوّد هذه الخدمة.",
  module_off: "محطة التواصل غير مفعّلة في رمز مختبرك.",
  site_only: "متاحة على موقع المزوّد فقط (مع رمز المختبر).",
  same_as_sync: "رمز المحادثة يطابق رمز المزامنة — اختر رمزاً مختلفاً.",
  blocked: "أوقف المزوّد مشاركة مختبرك في المحادثة العامة.",
  too_fast: "تمهّل قليلاً بين الرسائل.",
  no_name: "اختر اسماً مستعاراً في الإعدادات أولاً.",
  no_mailbox: "المختبر الآخر لم يفعّل صندوق البريد بعد — أرسلها بملف أو باتصال مباشر.",
  bad_token: "رمز المختبر على هذا الجهاز غير صالح.",
};
export const errorText = (e: string) => ERRORS[e] ?? "تعذّر الإرسال.";

// ── The lab's internal chat ──────────────────────────────────────────────────
interface RoomPayload { mid: string; from: string; text: string; urgent?: boolean; at: number }
export function sendRoom(text: string, urgent = false): Msg {
  const m = newOutgoing("room", text, "room", urgent);
  void flushRoom();
  return m;
}
/** One send at a time (the poller and a new message may both start one). */
function once(fn: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => (running ??= fn().finally(() => { running = null; }));
}
const flushRoom = once(async () => {
  const s = getSettings();
  if (!s.room) return;
  for (const m of messages().filter((x) => x.conv === "room" && x.dir === "out" && x.status === "pending")) {
    const box = sealRoom(s.room.key, { mid: m.id, from: m.from, text: m.text, urgent: m.urgent, at: m.at } satisfies RoomPayload);
    const r = await call({ op: "room_send", tag: s.room.tag, box });
    if (!r.ok) { setNet({ roomError: String(r.error ?? "") }); if (r.error === "same_as_sync") setStatus([m.id], "failed"); return; }
    setStatus([m.id], "sent", { sid: Number(r.id) });
  }
  if (net.roomError) setNet({ roomError: "" });
});
async function pollRoom() {
  const s = getSettings();
  if (!s.room) { if (net.online.length) setNet({ online: [] }); return; }
  const have = new Set(messages().filter((m) => m.conv === "room").map((m) => m.id));
  for (let i = 0; i < 10; i++) {
    const c = readCursors();
    const r = await call({ op: "room_poll", tag: s.room.tag, since: c.room, me: sealRoom(s.room.key, { name: s.name || "حاسوب" }) });
    if (!r.ok) { setNet({ roomError: String(r.error ?? "") }); return; }
    const rows = (r.rows as { id: number; at: number; box: string }[]) ?? [];
    const add: Msg[] = [];
    for (const row of rows) {
      const p = openRoom<RoomPayload>(s.room.key, row.box);
      if (!p || typeof p.text !== "string" || have.has(String(p.mid))) continue;
      have.add(String(p.mid));
      add.push({ id: String(p.mid), conv: "room", at: row.at, dir: "in", from: String(p.from ?? "حاسوب").slice(0, 40), text: p.text.slice(0, 4000), via: "room", sid: row.id, ...(p.urgent ? { urgent: true } : {}) });
    }
    addMessages(add);
    const max = rows.reduce((n, x) => Math.max(n, x.id), c.room);
    if (max !== c.room) writeCursors({ ...readCursors(), room: max });
    const online = ((r.online as { me: boolean; box: string }[]) ?? []).map((o) => ({ me: o.me, name: openRoom<{ name: string }>(s.room!.key, o.box)?.name ?? "؟" }));
    setNet({ online, roomError: "" });
    if (rows.length < 200) break;
  }
}

// ── «المحادثة العامة» ────────────────────────────────────────────────────────
export async function sendPublic(text: string): Promise<{ ok: boolean; error?: string }> {
  const s = getSettings();
  const r = await call({ op: "public_send", text, as: s.publicAs, alias: s.alias });
  if (!r.ok) return { ok: false, error: String(r.error ?? "") };
  addMessages([{ id: `p${r.id}`, conv: "public", at: Number(r.at), dir: "out", from: String(r.name), text, via: "public", status: "sent", sid: Number(r.id), labName: !!r.lab }]);
  return { ok: true };
}
async function pollPublic() {
  const c = readCursors();
  const r = await call({ op: "public_poll", since: c.public });
  if (!r.ok) { setNet({ publicError: String(r.error ?? "") }); return; }
  const rows = (r.rows as { id: number; at: number; name: string; lab: boolean; text: string; mine: boolean }[]) ?? [];
  addMessages(rows.map((x) => ({ id: `p${x.id}`, conv: "public", at: x.at, dir: x.mine ? "out" : "in", from: x.name, text: x.text, via: "public", sid: x.id, labName: x.lab, ...(x.mine ? { status: "sent" as const } : {}) })));
  removeMessages(((r.gone as number[]) ?? []).map((id) => `p${id}`));
  const max = rows.reduce((n, x) => Math.max(n, x.id), c.public);
  if (max !== c.public) writeCursors({ ...readCursors(), public: max });
  if (net.publicError) setNet({ publicError: "" });
}

// ── Other labs: direct, the mailbox, or a file ───────────────────────────────
interface MailPayload { mid: string; name: string; text: string; urgent?: boolean; at: number }
export const mailboxOn = () => !!net.info?.licensing && !!net.info.relay && getSettings().mailbox;
/** A message to a lab: at once when connected directly, else by the mailbox (when on); otherwise it
 *  waits for a direct connection or a file. */
export function sendToContact(contactId: string, text: string, urgent = false): Msg {
  const via = isConnected(contactId) ? "direct" : mailboxOn() ? "mailbox" : "file";
  const m = newOutgoing(`c:${contactId}`, text, via, urgent);
  void flushContact(contactId);
  return m;
}
/** Send what waits for a lab (called when a direct connection opens, and by the poller). */
const flushing = new Map<string, Promise<void>>();
export function flushContact(contactId: string): Promise<void> {
  const cur = flushing.get(contactId);
  if (cur) return cur;
  const p = flushOne(contactId).finally(() => flushing.delete(contactId));
  flushing.set(contactId, p);
  return p;
}
async function flushOne(contactId: string) {
  const c = contactById(contactId);
  if (!c) return;
  const waiting = messages().filter((m) => m.conv === `c:${contactId}` && m.dir === "out" && m.status === "pending");
  for (const m of waiting) {
    if (isConnected(contactId)) {
      if (directSend(contactId, { t: "msg", id: m.id, text: m.text, urgent: m.urgent, at: m.at })) setStatus([m.id], "sent", { via: "direct" });
      continue;
    }
    if (!mailboxOn()) continue;
    const box = sealFor(identity().priv, c.pub, { mid: m.id, name: myCard().name, text: m.text, urgent: m.urgent, at: m.at } satisfies MailPayload);
    const r = await call({ op: "mail_send", to: addressOf(c.pub), from: identity().pub, box });
    if (r.ok) setStatus([m.id], "sent", { via: "mailbox" });
    else { setNet({ mailError: String(r.error ?? "") }); if (r.error === "no_mailbox") return; }
  }
}
let registered = "";
async function pollMail() {
  if (!mailboxOn()) return;
  const addr = myAddress();
  if (registered !== addr) {
    const r = await call({ op: "mail_register", pub: identity().pub });
    if (!r.ok) { setNet({ mailError: String(r.error ?? "") }); return; }
    registered = addr;
  }
  const r = await call({ op: "mail_fetch", addr });
  if (!r.ok) { setNet({ mailError: String(r.error ?? "") }); return; }
  const rows = (r.rows as { id: number; from: string; at: number; box: string }[]) ?? [];
  const add: Msg[] = [];
  for (const row of rows) {
    const p = openFrom<MailPayload>(identity().priv, row.from, row.box);
    if (!p || typeof p.text !== "string") continue;
    const who = contactByPub(row.from) ?? addContact({ v: 1, name: String(p.name ?? "مختبر").slice(0, 60), pub: row.from }, false);
    add.push({ id: String(p.mid), conv: `c:${who.id}`, at: row.at, dir: "in", from: who.name, text: p.text.slice(0, 4000), via: "mailbox", ...(p.urgent ? { urgent: true } : {}) });
  }
  addMessages(add);
  if (rows.length) await call({ op: "mail_ack", addr, ids: rows.map((x) => x.id) });
  for (const c of new Set(messages().filter((m) => m.dir === "out" && m.status === "pending" && m.conv.startsWith("c:")).map((m) => m.conv.slice(2)))) await flushContact(c);
  if (net.mailError) setNet({ mailError: "" });
}

// ── The poller ───────────────────────────────────────────────────────────────
let started = false;
let tick = 0;
let lastIn = -1;
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const a = new Ctx(); const o = a.createOscillator(); const g = a.createGain();
    o.frequency.value = 880; g.gain.value = 0.06; o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.15); setTimeout(() => void a.close(), 400);
  } catch { /* no sound */ }
}
async function round() {
  const info = await serverInfo();
  if (info?.room) { await flushRoom(); await pollRoom(); }
  if (tick % 3 === 0) {
    if (info?.licensing && info.public) await pollPublic();
    await pollMail();
  }
  tick++;
  const n = messages().filter((m) => m.dir === "in" && m.conv !== "public").length;
  if (lastIn >= 0 && n > lastIn && getSettings().sound) beep();
  lastIn = n;
}
let busy = false;
/** Poll now (also after sending, and on the timer). */
export async function pollNow() {
  if (busy) return;
  busy = true;
  try { await round(); } finally { busy = false; }
}
export function startConnect() {
  if (started || typeof window === "undefined") return;
  started = true;
  pruneOld();
  void pollNow();
  setInterval(() => { if (document.visibilityState === "visible") void pollNow(); }, 4000);
  window.addEventListener("online", () => void pollNow());
}
