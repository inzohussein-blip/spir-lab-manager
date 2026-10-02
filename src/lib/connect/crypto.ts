/**
 * «محطة التواصل» — encryption (plain JS: the same on http inside the lab's network, where the
 * browser's own crypto.subtle is not offered, and on https).
 *
 * • Each computer has its own key pair (X25519). Two labs meet once with «بطاقة التعارف» (the
 *   public key and a name) and check the fingerprint by phone; a message to a lab is sealed with
 *   both keys (XChaCha20-Poly1305), so only that lab opens it — not the file's carrier, not the
 *   provider's mailbox.
 * • The lab's internal chat uses «رمز المحادثة», typed on each of its computers: a key and a room
 *   name come from it (PBKDF2), and the server keeps only sealed messages under that name.
 */
import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { sha256 } from "@noble/hashes/sha2";
import { hkdf } from "@noble/hashes/hkdf";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { randomBytes, bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

// ── base64url ────────────────────────────────────────────────────────────────
export function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const enc = (o: unknown) => utf8ToBytes(JSON.stringify(o));
const dec = <T,>(b: Uint8Array): T => JSON.parse(new TextDecoder().decode(b)) as T;

// ── This computer's identity ─────────────────────────────────────────────────
export interface Identity { priv: string; pub: string; at: number }
export function newIdentity(): Identity {
  const priv = x25519.utils.randomPrivateKey();
  return { priv: b64(priv), pub: b64(x25519.getPublicKey(priv)), at: Date.now() };
}
/** 20 hex characters in 5 groups — read aloud to check a card is the other lab's. */
export function fingerprint(pub: string): string {
  const h = bytesToHex(sha256(unb64(pub))).slice(0, 20).toUpperCase();
  return h.match(/.{4}/g)!.join(" ");
}
/** The mailbox address of a public key (what the provider's server knows a lab by). */
export const addressOf = (pub: string) => bytesToHex(sha256(utf8ToBytes(`spir-connect-addr:${pub}`))).slice(0, 40);
export const validPub = (pub: unknown): pub is string => { try { return typeof pub === "string" && unb64(pub).length === 32; } catch { return false; } };

// ── «بطاقة التعارف» ──────────────────────────────────────────────────────────
export interface Card { v: 1; name: string; pub: string }
const CARD_PREFIX = "SPIR-CARD:";
export const cardText = (c: Card) => CARD_PREFIX + b64(enc(c));
export function readCard(text: string): Card | null {
  const t = text.trim().replace(/\s+/g, "");
  if (!t.startsWith(CARD_PREFIX)) return null;
  try {
    const c = dec<Card>(unb64(t.slice(CARD_PREFIX.length)));
    return c && c.v === 1 && validPub(c.pub) ? { v: 1, name: String(c.name ?? "").slice(0, 60), pub: c.pub } : null;
  } catch { return null; }
}

// ── Sealing between two keys ─────────────────────────────────────────────────
function pairKey(myPriv: string, theirPub: string): Uint8Array {
  const shared = x25519.getSharedSecret(unb64(myPriv), unb64(theirPub));
  return hkdf(sha256, shared, utf8ToBytes("spir-connect-v1"), utf8ToBytes("pair"), 32);
}
/** Seal for one recipient: only the holder of its key (or this computer) opens it. */
export function sealFor(myPriv: string, theirPub: string, data: unknown): string {
  const n = randomBytes(24);
  return `${b64(n)}.${b64(xchacha20poly1305(pairKey(myPriv, theirPub), n).encrypt(enc(data)))}`;
}
export function openFrom<T>(myPriv: string, theirPub: string, box: string): T | null {
  try {
    const [n, c] = box.split(".");
    return dec<T>(xchacha20poly1305(pairKey(myPriv, theirPub), unb64(n)).decrypt(unb64(c)));
  } catch { return null; }
}

// ── The lab's internal chat («رمز المحادثة») ─────────────────────────────────
export interface RoomKeys { tag: string; key: string }
/** At least 8 characters; the same code on each of the lab's computers. */
export const validRoomCode = (code: string) => code.trim().length >= 8;
export function roomKeys(code: string): RoomKeys {
  const m = pbkdf2(sha256, utf8ToBytes(code.trim()), utf8ToBytes("spir-connect-room-v1"), { c: 60_000, dkLen: 64 });
  return { key: b64(m.slice(0, 32)), tag: bytesToHex(sha256(m.slice(32))).slice(0, 40) };
}
export function sealRoom(key: string, data: unknown): string {
  const n = randomBytes(24);
  return `${b64(n)}.${b64(xchacha20poly1305(unb64(key), n).encrypt(enc(data)))}`;
}
export function openRoom<T>(key: string, box: string): T | null {
  try {
    const [n, c] = box.split(".");
    return dec<T>(xchacha20poly1305(unb64(key), unb64(n)).decrypt(unb64(c)));
  } catch { return null; }
}
