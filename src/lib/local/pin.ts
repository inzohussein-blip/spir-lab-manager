"use client";

import { useEffect, useState } from "react";

/**
 * «رمز الدخول» (PIN) for the local stations: none at first; every station can switch its own on
 * in its settings. From /license («رموز الدخول») the owner can, per lab code, hide the feature,
 * set / change / remove a station's PIN — and give one station several PINs (only from there) —
 * the device applies that at its next check with the server. Kept on this device only
 * (localStorage, never synced); an unlock lasts for the browser tab. A guard for a shared
 * computer, not strong security.
 */

export type PinStation = "station" | "purchasing" | "training" | "qc" | "roster" | "connect" | "sync" | "about";
/** The owner's old single change (kept for codes set before «رموز الدخول»; see lib/license/server PinOp). */
export interface PinOp { id: string; hash: string | null; scope: PinStation | "admin" | "all"; at: number }
/** One PIN the owner gave a station: its hash and a name («الصباحي», «المدير»…). */
export interface PinEntry { hash: string; label: string }
/** The owner's PIN settings for a code (lib/license/server PinPolicy): a station is applied again
 *  only when its rev changes, so the lab's own change in its settings is kept until then. */
export interface PinPolicy { id: string; at: number; hidden: boolean; stations: Partial<Record<PinStation, { rev: string; pins: PinEntry[] | null }>> }

const K = "local.pin.v1";
const UNLOCK = "local.pin.unlocked";
export const PIN_EVENT = "local-pin";
export const PIN_STATIONS: PinStation[] = ["station", "purchasing", "training", "qc", "roster", "connect", "sync", "about"];
const STATIONS = PIN_STATIONS;
interface Stored {
  /** Each station's main PIN (set here, or the owner's first). */
  pins: Partial<Record<PinStation, string>>;
  /** More PINs for a station, from the owner only. */
  extra?: Partial<Record<PinStation, string[]>>;
  /** The owner's rev last applied per station. */
  revs?: Partial<Record<PinStation, string>>;
  /** The owner hid the feature for this lab: no PIN asked, nothing to set. */
  hidden?: boolean;
  applied?: string;
}

// ── SHA-256 (plain JS: the same answer on http and https, and the same as the server's) ──────────
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length, words = ((len + 9 + 63) >> 6) << 4;
  const w = new Uint32Array(words);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  w[words - 1] = len * 8;
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const m = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let b = 0; b < words; b += 16) {
    for (let t = 0; t < 64; t++) {
      if (t < 16) m[t] = w[b + t];
      else {
        const s0 = rotr(m[t - 15], 7) ^ rotr(m[t - 15], 18) ^ (m[t - 15] >>> 3);
        const s1 = rotr(m[t - 2], 17) ^ rotr(m[t - 2], 19) ^ (m[t - 2] >>> 10);
        m[t] = (m[t - 16] + s0 + m[t - 7] + s1) | 0;
      }
    }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[t] + m[t]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}
export const hashPin = (pin: string) => sha256Hex(`spir-station-pin:${pin.trim()}`);
/** 4 to 8 digits (Arabic-keyboard digits are accepted and read as 1 2 3). */
export const cleanPin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/\D/g, "").slice(0, 8);
export const validPin = (s: string) => /^\d{4,8}$/.test(s);

// ── Storage ──────────────────────────────────────────────────────────────────────────────────
function read(): Stored {
  try { const v = JSON.parse(localStorage.getItem(K) ?? "null") as Stored | null; return v && typeof v.pins === "object" ? v : { pins: {} }; } catch { return { pins: {} }; }
}
function write(s: Stored) { try { localStorage.setItem(K, JSON.stringify(s)); } catch { /* ignore */ } notify(); }
function unlocked(): PinStation[] {
  try { const v = JSON.parse(sessionStorage.getItem(UNLOCK) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function setUnlocked(list: PinStation[]) { try { sessionStorage.setItem(UNLOCK, JSON.stringify(Array.from(new Set(list)))); } catch { /* ignore */ } }
function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event(PIN_EVENT)); }

const extras = (s: Stored, st: PinStation) => s.extra?.[st] ?? [];
export const pinHidden = () => !!read().hidden;
export const pinOn = (st: PinStation) => { const s = read(); return !s.hidden && (!!s.pins[st] || extras(s, st).length > 0); };
export const isLocked = (st: PinStation) => pinOn(st) && !unlocked().includes(st);
/** How many more PINs the owner gave this station. */
export const pinExtraCount = (st: PinStation) => extras(read(), st).length;

/** Switch the PIN on / change it (pin), or off (null: the owner's extra PINs go too).
 *  Whoever sets it stays unlocked. */
export function setPin(st: PinStation, pin: string | null): void {
  const s = read();
  if (pin) { s.pins[st] = hashPin(pin); setUnlocked([...unlocked(), st]); }
  else { delete s.pins[st]; if (s.extra) delete s.extra[st]; }
  write(s);
}
export function tryPin(st: PinStation, pin: string): boolean {
  const s = read(), h = hashPin(pin);
  const ok = s.pins[st] === h || extras(s, st).includes(h);
  if (ok) { setUnlocked([...unlocked(), st]); notify(); }
  return ok;
}
export function lockNow(st: PinStation): void {
  setUnlocked(unlocked().filter((x) => x !== st));
  notify();
}

/** Apply the owner's old single change from /license once (codes set before «رموز الدخول»). */
export function applyPinOp(op: PinOp | null | undefined): void {
  if (!op || typeof op.id !== "string") return;
  const s = read();
  if (s.applied === op.id) return;
  const targets = op.scope === "all" ? STATIONS : STATIONS.filter((x) => x === op.scope);
  for (const t of targets) { if (op.hash) s.pins[t] = op.hash; else delete s.pins[t]; }
  s.applied = op.id;
  // A new PIN from the owner must be typed once, even in a tab that was open.
  if (op.hash) setUnlocked(unlocked().filter((x) => !targets.includes(x)));
  write(s);
}

/** Apply the owner's «رموز الدخول» (called when the license is refreshed): hidden or shown, and
 *  each station whose rev changed — its PINs replaced (the first is the main one), or removed. */
export function applyPinPolicy(p: PinPolicy | null | undefined): void {
  if (!p || typeof p !== "object" || typeof p.stations !== "object" || !p.stations) return;
  const s = read();
  const revs = { ...(s.revs ?? {}) };
  const extra = { ...(s.extra ?? {}) };
  const relock: PinStation[] = [];
  let changed = !!s.hidden !== !!p.hidden;
  s.hidden = !!p.hidden;
  for (const st of STATIONS) {
    const e = p.stations[st];
    if (!e || typeof e.rev !== "string" || revs[st] === e.rev) continue;
    const hashes = Array.isArray(e.pins) ? e.pins.map((x) => x?.hash).filter((h): h is string => typeof h === "string" && /^[0-9a-f]{64}$/.test(h)) : [];
    if (hashes.length) { s.pins[st] = hashes[0]; extra[st] = hashes.slice(1); relock.push(st); }
    else { delete s.pins[st]; delete extra[st]; }
    revs[st] = e.rev;
    changed = true;
  }
  if (!changed) return;
  s.revs = revs; s.extra = extra;
  // A new PIN from the owner must be typed once, even in a tab that was open.
  if (relock.length) setUnlocked(unlocked().filter((x) => !relock.includes(x)));
  write(s);
}

/** { ready, on, locked, hidden, extra } for a station — re-renders on every change. */
export function usePin(st: PinStation) {
  const [state, setState] = useState({ ready: false, on: false, locked: false, hidden: false, extra: 0 });
  useEffect(() => {
    const upd = () => setState({ ready: true, on: pinOn(st), locked: isLocked(st), hidden: pinHidden(), extra: pinExtraCount(st) });
    upd();
    window.addEventListener(PIN_EVENT, upd);
    window.addEventListener("storage", upd);
    return () => { window.removeEventListener(PIN_EVENT, upd); window.removeEventListener("storage", upd); };
  }, [st]);
  return state;
}
