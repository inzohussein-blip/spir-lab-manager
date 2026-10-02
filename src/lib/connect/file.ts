"use client";

/**
 * «رسالة بملف»: messages to another lab sealed in a file (any carrier — a flash drive, WhatsApp,
 * e-mail — sees only a sealed file). The file carries the sender's card, so the receiving lab
 * knows who sent it and can check the fingerprint.
 */
import { sealFor, openFrom, fingerprint, validPub, type Card } from "./crypto";
import { identity, myCard, myFingerprint, contactById, contactByPub, addContact, addMessages, messages, newOutgoing, setStatus, type Contact } from "./store";

export interface MsgFile { app: "spir-msg"; v: 1; from: Card; to: string; at: number; box: string }
interface Sealed { msgs: { mid: string; text: string; urgent?: boolean; at: number }[] }

/** The file for a lab: what waits for it, plus a new message when given. */
export function exportFor(contactId: string, text?: string, urgent = false): { file: MsgFile; count: number } | null {
  const c = contactById(contactId);
  if (!c) return null;
  if (text?.trim()) newOutgoing(`c:${contactId}`, text.trim(), "file", urgent);
  const waiting = messages().filter((m) => m.conv === `c:${contactId}` && m.dir === "out" && m.status === "pending");
  if (!waiting.length) return null;
  const box = sealFor(identity().priv, c.pub, { msgs: waiting.map((m) => ({ mid: m.id, text: m.text, urgent: m.urgent, at: m.at })) } satisfies Sealed);
  setStatus(waiting.map((m) => m.id), "sent", { via: "file" });
  return { file: { app: "spir-msg", v: 1, from: myCard(), to: c.fp, at: Date.now(), box }, count: waiting.length };
}
export const fileName = (c: Contact) => `spir-msg-${c.name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${new Date().toISOString().slice(0, 10)}.json`;

export type ImportResult = { ok: true; contact: Contact; count: number; known: boolean } | { ok: false; error: "not_msg" | "not_for_me" | "broken" };
export function importFile(raw: unknown): ImportResult {
  const f = raw as MsgFile;
  if (!f || f.app !== "spir-msg" || !f.from || !validPub(f.from.pub) || typeof f.box !== "string") return { ok: false, error: "not_msg" };
  if (f.to !== myFingerprint()) return { ok: false, error: "not_for_me" };
  const data = openFrom<Sealed>(identity().priv, f.from.pub, f.box);
  if (!data || !Array.isArray(data.msgs)) return { ok: false, error: "broken" };
  const known = !!contactByPub(f.from.pub);
  const c = contactByPub(f.from.pub) ?? addContact({ v: 1, name: String(f.from.name ?? "مختبر").slice(0, 60), pub: f.from.pub }, false);
  const before = new Set(messages().map((m) => m.id));
  const add = data.msgs.filter((m) => typeof m?.text === "string" && !before.has(String(m.mid))).map((m) => ({
    id: String(m.mid), conv: `c:${c.id}`, at: Number(m.at) || Date.now(), dir: "in" as const, from: c.name, text: m.text.slice(0, 4000), via: "file" as const, ...(m.urgent ? { urgent: true } : {}),
  }));
  addMessages(add);
  return { ok: true, contact: c, count: add.length, known };
}
export { fingerprint };
