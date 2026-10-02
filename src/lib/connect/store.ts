"use client";

/**
 * «محطة التواصل» — what this computer keeps (lib/local/kv under "connect.*", never synced with
 * the lab's other computers): its settings, its key pair, the labs it knows and the messages.
 * Messages older than the chosen days are removed on open (0: kept).
 */
import { useEffect, useState } from "react";
import { readLS, writeLS, newId } from "@/lib/local/util";
import { newIdentity, fingerprint, addressOf, cardText, roomKeys, validRoomCode, type Identity, type Card, type RoomKeys } from "./crypto";

export type Via = "room" | "public" | "direct" | "mailbox" | "file";
export type MsgStatus = "pending" | "sent" | "failed";
/** A message in one conversation: "room" (the lab's computers), "public", or "c:<contact id>". */
export interface Msg {
  id: string; conv: string; at: number; dir: "in" | "out"; from: string; text: string; via: Via;
  status?: MsgStatus; urgent?: boolean;
  /** Public chat: the sender's lab name was checked by the server (not a chosen alias). */
  labName?: boolean;
  /** The server's number for a public / room message (to skip it when it comes again). */
  sid?: number;
}
/** Another lab (or one of this lab's computers met by a direct connection). */
export interface Contact { id: string; name: string; pub: string; fp: string; at: number; verified: boolean; note?: string }
export interface ConnectSettings {
  /** This computer's name in the lab's internal chat. */
  name: string;
  /** The name on this computer's «بطاقة التعارف» for other labs. */
  labName: string;
  /** «المحادثة العامة»: a chosen name, or the lab's own name (checked by the server). */
  alias: string;
  publicAs: "alias" | "lab";
  /** Days a message is kept (0: always). */
  retentionDays: number;
  sound: boolean;
  /** «رسائل جاهزة» (one click). */
  quick: string[];
  /** A public STUN server helps a direct connection between two labs find its way (it never sees
   *  a message). Off: only the lab's own network. */
  stun: boolean;
  /** The provider's sealed mailbox for messages to other labs (when the provider allows it). */
  mailbox: boolean;
  /** From «رمز المحادثة» (the code itself is not kept). */
  room?: RoomKeys & { at: number };
}
export const DEFAULT_QUICK = ["العينة جاهزة", "النتيجة أُرسلت", "نحتاج أنابيب", "يرجى الاتصال", "تم، شكراً"];
const DEFAULTS: ConnectSettings = {
  name: "", labName: "", alias: "", publicAs: "alias", retentionDays: 30, sound: true, quick: DEFAULT_QUICK, stun: false, mailbox: false,
};

const K = {
  settings: "connect.settings.v1", identity: "connect.identity.v1", contacts: "connect.contacts.v1",
  messages: "connect.messages.v1", cursors: "connect.cursors.v1", read: "connect.read.v1",
};
export const CONNECT_EVENT = "connect-change";
const changed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(CONNECT_EVENT)); };
const MAX_MESSAGES = 5000;
const MAX_PUBLIC = 300;

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): ConnectSettings {
  const s = readLS<Partial<ConnectSettings>>(K.settings, {});
  return { ...DEFAULTS, ...s, quick: Array.isArray(s.quick) ? s.quick.filter((x) => typeof x === "string") : DEFAULTS.quick };
}
export function saveSettings(patch: Partial<ConnectSettings>): ConnectSettings {
  const next = { ...getSettings(), ...patch };
  writeLS(K.settings, next); changed();
  return next;
}
/** «رمز المحادثة» of the lab's internal chat: it must differ from the sync's key («خادم الشبكة المحلية»). */
export function setRoomCode(code: string | null): { ok: true } | { ok: false; error: "short" | "same_as_sync" } {
  if (code === null) { const s = getSettings(); delete s.room; writeLS(K.settings, s); changed(); return { ok: true }; }
  if (!validRoomCode(code)) return { ok: false, error: "short" };
  let syncKey = "";
  try { syncKey = (localStorage.getItem("lab-hub-key") ?? "").trim(); } catch { /* none */ } // lib/sync/client HUB_KEY
  if (syncKey && syncKey === code.trim()) return { ok: false, error: "same_as_sync" };
  saveSettings({ room: { ...roomKeys(code), at: Date.now() } });
  writeCursors({ ...readCursors(), room: 0 });
  return { ok: true };
}

// ── This computer's keys ─────────────────────────────────────────────────────
export function identity(): Identity {
  let id = readLS<Identity | null>(K.identity, null);
  if (!id?.priv || !id.pub) { id = newIdentity(); writeLS(K.identity, id); }
  return id;
}
/** A new key pair: the labs that know this computer must add its new card again. */
export function renewIdentity(): Identity {
  const id = newIdentity(); writeLS(K.identity, id); changed();
  return id;
}
export function myCard(): Card {
  const s = getSettings();
  return { v: 1, name: s.labName.trim() || s.name.trim() || "مختبر", pub: identity().pub };
}
export const myCardText = () => cardText(myCard());
export const myFingerprint = () => fingerprint(identity().pub);
export const myAddress = () => addressOf(identity().pub);

// ── Contacts ─────────────────────────────────────────────────────────────────
export const contactIdOf = (pub: string) => addressOf(pub).slice(0, 16);
export function contacts(): Contact[] { return readLS<Contact[]>(K.contacts, []); }
export function contactById(id: string): Contact | undefined { return contacts().find((c) => c.id === id); }
export function contactByPub(pub: string): Contact | undefined { return contacts().find((c) => c.pub === pub); }
/** Add (or rename) a lab from its card; one met by a message or a direct connection starts unchecked. */
export function addContact(card: Card, verified = false): Contact {
  const list = contacts();
  const id = contactIdOf(card.pub);
  const cur = list.find((c) => c.id === id);
  if (cur) {
    if (verified && !cur.verified) { cur.verified = true; writeLS(K.contacts, list); changed(); }
    return cur;
  }
  const c: Contact = { id, name: card.name || "مختبر", pub: card.pub, fp: fingerprint(card.pub), at: Date.now(), verified };
  writeLS(K.contacts, [...list, c]); changed();
  return c;
}
export function updateContact(id: string, patch: Partial<Pick<Contact, "name" | "verified" | "note">>) {
  writeLS(K.contacts, contacts().map((c) => (c.id === id ? { ...c, ...patch } : c))); changed();
}
export function removeContact(id: string) {
  writeLS(K.contacts, contacts().filter((c) => c.id !== id));
  writeLS(K.messages, messages().filter((m) => m.conv !== `c:${id}`)); changed();
}

// ── Messages ─────────────────────────────────────────────────────────────────
export function messages(): Msg[] { return readLS<Msg[]>(K.messages, []); }
export const messagesOf = (conv: string) => messages().filter((m) => m.conv === conv).sort((a, b) => a.at - b.at);
export function addMessages(list: Msg[]) {
  if (!list.length) return;
  const all = messages();
  const have = new Set(all.map((m) => m.id));
  const fresh = list.filter((m) => !have.has(m.id) && (have.add(m.id), true));
  if (!fresh.length) return;
  let next = [...all, ...fresh];
  // The public chat keeps its latest messages only; the rest, the latest MAX_MESSAGES.
  const pub = next.filter((m) => m.conv === "public");
  if (pub.length > MAX_PUBLIC) { const drop = new Set(pub.sort((a, b) => a.at - b.at).slice(0, pub.length - MAX_PUBLIC).map((m) => m.id)); next = next.filter((m) => !drop.has(m.id)); }
  if (next.length > MAX_MESSAGES) next = next.sort((a, b) => a.at - b.at).slice(-MAX_MESSAGES);
  writeLS(K.messages, next); changed();
}
export function newOutgoing(conv: string, text: string, via: Via, urgent = false): Msg {
  const s = getSettings();
  // Shown here as «أنا» when the computer has no name (lib/connect Thread); sent as «حاسوب».
  const m: Msg = { id: newId(), conv, at: Date.now(), dir: "out", from: s.name.trim(), text, via, status: "pending", ...(urgent ? { urgent } : {}) };
  addMessages([m]);
  return m;
}
export function setStatus(ids: string[], status: MsgStatus, extra?: Partial<Msg>) {
  if (!ids.length) return;
  const set = new Set(ids);
  writeLS(K.messages, messages().map((m) => (set.has(m.id) ? { ...m, status, ...extra } : m))); changed();
}
/** Remove some messages (the owner deleted them from the public chat). */
export function removeMessages(ids: string[]) {
  if (!ids.length) return;
  const set = new Set(ids);
  const all = messages();
  const keep = all.filter((m) => !set.has(m.id));
  if (keep.length !== all.length) { writeLS(K.messages, keep); changed(); }
}
export function deleteConversation(conv: string) { writeLS(K.messages, messages().filter((m) => m.conv !== conv)); changed(); }
/** Remove messages older than the chosen days (on open). */
export function pruneOld() {
  const days = getSettings().retentionDays;
  if (!days) return;
  const cut = Date.now() - days * 86_400_000;
  const all = messages();
  const keep = all.filter((m) => m.at >= cut || m.status === "pending");
  if (keep.length !== all.length) { writeLS(K.messages, keep); changed(); }
}

// ── Read marks and the server's cursors ──────────────────────────────────────
export function markRead(conv: string) {
  const r = readLS<Record<string, number>>(K.read, {});
  // The latest message's own time (not this computer's clock, which may differ from the server's).
  const last = messagesOf(conv).at(-1)?.at;
  if (last == null || (r[conv] ?? 0) >= last) return;
  writeLS(K.read, { ...r, [conv]: last }); changed();
}
export function unread(conv?: string): number {
  const r = readLS<Record<string, number>>(K.read, {});
  return messages().filter((m) => m.dir === "in" && (!conv || m.conv === conv) && m.at > (r[m.conv] ?? 0)).length;
}
export interface Cursors { room: number; public: number }
export const readCursors = (): Cursors => ({ room: 0, public: 0, ...readLS<Partial<Cursors>>(K.cursors, {}) });
export const writeCursors = (c: Cursors) => writeLS(K.cursors, c);

// ── Backup: this computer's key, its labs, settings and messages ─────────────
export interface ConnectBackup { app: "spir-connect-backup"; v: 1; at: number; data: Record<string, unknown> }
export function exportBackup(): ConnectBackup {
  const data: Record<string, unknown> = {};
  for (const k of Object.values(K)) data[k] = readLS<unknown>(k, null);
  return { app: "spir-connect-backup", v: 1, at: Date.now(), data };
}
/** Replace this computer's station data with a backup (its key too: the labs keep knowing it). */
export function importBackup(raw: unknown): boolean {
  const b = raw as ConnectBackup;
  if (!b || b.app !== "spir-connect-backup" || !b.data || typeof b.data !== "object") return false;
  const id = b.data[K.identity] as Identity | null;
  if (id && (typeof id.priv !== "string" || typeof id.pub !== "string")) return false;
  for (const k of Object.values(K)) { const v = b.data[k]; if (v != null) writeLS(k, v); }
  changed();
  return true;
}

/** Re-render on every change of the station's data (this tab or the poller). */
export function useConnect(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const up = () => setN((x) => x + 1);
    window.addEventListener(CONNECT_EVENT, up);
    return () => window.removeEventListener(CONNECT_EVENT, up);
  }, []);
  return n;
}

/** Conversations for the lists: the internal chat, the public chat and each lab, latest first. */
export interface ConvInfo { conv: string; title: string; last?: Msg; unread: number }
export function conversations(): ConvInfo[] {
  const r = readLS<Record<string, number>>(K.read, {});
  const all = messages();
  const info = (conv: string, title: string): ConvInfo => {
    const ms = all.filter((m) => m.conv === conv);
    return { conv, title, last: ms.sort((a, b) => a.at - b.at).at(-1), unread: ms.filter((m) => m.dir === "in" && m.at > (r[conv] ?? 0)).length };
  };
  return [
    info("room", "المحادثة الداخلية"), info("public", "المحادثة العامة"),
    ...contacts().map((c) => info(`c:${c.id}`, c.name)),
  ].sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
}
