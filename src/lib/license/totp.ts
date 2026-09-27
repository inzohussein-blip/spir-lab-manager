import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/**
 * Time-based one-time codes (RFC 6238 — Google Authenticator, Microsoft Authenticator…):
 * 6 digits, a new one every 30 seconds, from a secret shared once by QR code.
 */
const STEP = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/[\s=-]/g, "").toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32(randomBytes(20));
export const totpStep = (ms = Date.now()) => Math.floor(ms / 1000 / STEP);

export function totpCode(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** The time step a code belongs to (this one, or one either side for clock drift), or null. */
export function totpMatch(secret: string, code: string, ms = Date.now()): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = totpStep(ms);
  for (const s of [now, now - 1, now + 1]) if (totpCode(secret, s) === c) return s;
  return null;
}

export const totpUri = (secret: string, label: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${label}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
