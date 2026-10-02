"use client";

/**
 * «اتصال مباشر» (WebRTC): two computers talk to each other with nothing in between. They meet by
 * a «رمز ربط» copied (or scanned) from one to the other and back: the first makes an invitation,
 * the second answers it, the first enters the answer. The channel is encrypted by the browser
 * itself (DTLS); each side then shows its card, so the other knows which lab it is.
 *
 * Without a STUN server only the lab's own network is reachable; with one (settings), two labs
 * over the internet may connect too — the STUN server only tells a computer its own address and
 * never sees a message. A connection lasts while the station stays open on both computers.
 */
import { b64, unb64 } from "./crypto";
import { getSettings, myCard, addContact, addMessages, setStatus, CONNECT_EVENT } from "./store";
import type { Card } from "./crypto";

type Wire =
  | { t: "hello"; card: Card }
  | { t: "msg"; id: string; text: string; urgent?: boolean; at: number }
  | { t: "ack"; id: string };
export interface Peer {
  id: string; state: "inviting" | "answering" | "connecting" | "open" | "closed";
  contactId?: string; name?: string; at: number;
  pc: RTCPeerConnection; dc?: RTCDataChannel;
}
const peers = new Map<string, Peer>();
const emit = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(CONNECT_EVENT)); };
const PREFIX = "SPIR-LINK:";
export const directSupported = () => typeof window !== "undefined" && typeof window.RTCPeerConnection === "function";
export const listPeers = (): Peer[] => [...peers.values()].sort((a, b) => b.at - a.at);
export const isConnected = (contactId: string) => [...peers.values()].some((p) => p.contactId === contactId && p.state === "open");

function iceServers(): RTCIceServer[] {
  return getSettings().stun ? [{ urls: "stun:stun.l.google.com:19302" }] : [];
}
/** Wait until the computer knows all its addresses (no server passes them later). */
function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((res) => {
    const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); res(); } };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(res, 4000);
  });
}
const encode = (t: "o" | "a", sdp: string) => PREFIX + b64(new TextEncoder().encode(JSON.stringify({ t, sdp })));
function decode(code: string): { t: "o" | "a"; sdp: string } | null {
  const s = code.trim().replace(/\s+/g, "");
  if (!s.startsWith(PREFIX)) return null;
  try {
    const v = JSON.parse(new TextDecoder().decode(unb64(s.slice(PREFIX.length))));
    return (v?.t === "o" || v?.t === "a") && typeof v.sdp === "string" ? v : null;
  } catch { return null; }
}
const newPeerId = () => Math.random().toString(36).slice(2, 10);

function wire(p: Peer, dc: RTCDataChannel) {
  p.dc = dc;
  dc.onopen = () => { p.state = "open"; send(p, { t: "hello", card: myCard() }); emit(); };
  dc.onclose = () => { p.state = "closed"; emit(); };
  dc.onmessage = (e) => {
    let w: Wire;
    try { w = JSON.parse(String(e.data)); } catch { return; }
    if (w.t === "hello" && w.card?.pub) {
      const c = addContact({ v: 1, name: String(w.card.name ?? "").slice(0, 60), pub: w.card.pub }, false);
      p.contactId = c.id; p.name = c.name; emit();
      void import("./net").then((m) => m.flushContact(c.id));
    } else if (w.t === "msg" && p.contactId && typeof w.text === "string") {
      addMessages([{ id: String(w.id), conv: `c:${p.contactId}`, at: Number(w.at) || Date.now(), dir: "in", from: p.name ?? "", text: w.text.slice(0, 4000), via: "direct", ...(w.urgent ? { urgent: true } : {}) }]);
      send(p, { t: "ack", id: String(w.id) });
    } else if (w.t === "ack") {
      setStatus([String(w.id)], "sent");
    }
  };
  p.pc.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(p.pc.connectionState)) { p.state = "closed"; emit(); } };
}
function send(p: Peer, w: Wire): boolean {
  if (p.dc?.readyState !== "open") return false;
  try { p.dc.send(JSON.stringify(w)); return true; } catch { return false; }
}
export function directSend(contactId: string, w: Wire): boolean {
  const p = [...peers.values()].find((x) => x.contactId === contactId && x.state === "open");
  return !!p && send(p, w);
}

/** First computer: an invitation code to give the other one. */
export async function createInvite(): Promise<{ peer: string; code: string }> {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const p: Peer = { id: newPeerId(), state: "inviting", at: Date.now(), pc };
  peers.set(p.id, p);
  wire(p, pc.createDataChannel("spir-connect"));
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  emit();
  return { peer: p.id, code: encode("o", pc.localDescription!.sdp) };
}
/** Second computer: enter the invitation, get the answer code to give back. */
export async function answerInvite(code: string): Promise<{ ok: true; peer: string; code: string } | { ok: false; error: "bad_code" }> {
  const d = decode(code);
  if (!d || d.t !== "o") return { ok: false, error: "bad_code" };
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const p: Peer = { id: newPeerId(), state: "answering", at: Date.now(), pc };
  peers.set(p.id, p);
  pc.ondatachannel = (e) => wire(p, e.channel);
  await pc.setRemoteDescription({ type: "offer", sdp: d.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  p.state = "connecting"; emit();
  return { ok: true, peer: p.id, code: encode("a", pc.localDescription!.sdp) };
}
/** First computer again: enter the answer — the two are connected. */
export async function acceptAnswer(peer: string, code: string): Promise<{ ok: boolean; error?: "bad_code" | "no_invite" }> {
  const p = peers.get(peer);
  if (!p || p.state !== "inviting") return { ok: false, error: "no_invite" };
  const d = decode(code);
  if (!d || d.t !== "a") return { ok: false, error: "bad_code" };
  try { await p.pc.setRemoteDescription({ type: "answer", sdp: d.sdp }); } catch { return { ok: false, error: "bad_code" }; }
  p.state = "connecting"; emit();
  return { ok: true };
}
export function closePeer(peer: string) {
  const p = peers.get(peer);
  if (!p) return;
  try { p.dc?.close(); p.pc.close(); } catch { /* closed */ }
  peers.delete(peer); emit();
}
