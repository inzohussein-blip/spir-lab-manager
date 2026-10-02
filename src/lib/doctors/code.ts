/**
 * «رموز الأطباء» — the doctor's code and what comes from it (plain JS: the same on http inside
 * the lab's network and on https).
 *
 * The lab makes a code for a doctor (12 characters, shown once). From the code come a key and a
 * name (PBKDF2): the lab's computer seals the doctor's results with the key and leaves them on the
 * server under the name; the doctor types the code and opens them in the browser. The server never
 * sees the code and cannot read the results.
 */
import { sha256 } from "@noble/hashes/sha2";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { randomBytes, bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { sealRoom, openRoom, b64 } from "@/lib/connect/crypto";

/** No 0/O, 1/I/L: read aloud or typed from a phone without mistakes. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newDoctorCode(): string {
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
/** As typed: lower case, spaces, Arabic dashes… all read the same. */
export const cleanDoctorCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const validDoctorCode = (code: string) => /^[A-Z0-9]{12}$/.test(cleanDoctorCode(code));

export interface DoctorKeys { tag: string; key: string }
export function doctorKeys(code: string): DoctorKeys {
  const m = pbkdf2(sha256, utf8ToBytes(cleanDoctorCode(code)), utf8ToBytes("spir-doctor-v1"), { c: 60_000, dkLen: 64 });
  return { key: b64(m.slice(0, 32)), tag: bytesToHex(sha256(m.slice(32))).slice(0, 40) };
}
export const okTag = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{40}$/.test(t);

// ── What the doctor receives ─────────────────────────────────────────────────
export type DoctorWindow = "day" | "week" | "month" | "year";
export const WINDOW_DAYS: Record<DoctorWindow, number> = { day: 1, week: 7, month: 31, year: 366 };
export const WINDOW_LABEL: Record<DoctorWindow, string> = { day: "آخر يوم", week: "آخر أسبوع", month: "آخر شهر", year: "آخر سنة" };
export interface DoctorResult { name: string; value: string; unit?: string; range?: string; flag?: "H" | "L" | "N" | null; hl?: boolean }
export interface DoctorVisit {
  id: string; at: number; acc?: string;
  patient: { name: string; gender: string; age?: string; phone?: string };
  results: DoctorResult[];
  delivered?: number;
}
export interface DoctorSnapshot {
  v: 1;
  lab: { name: string; sub?: string; footer?: string };
  doctor: string;
  window: DoctorWindow;
  /** When the lab's computer made it. */
  at: number;
  visits: DoctorVisit[];
}
export const sealSnapshot = (key: string, s: DoctorSnapshot) => sealRoom(key, s);
export function openSnapshot(key: string, box: string): DoctorSnapshot | null {
  const s = openRoom<DoctorSnapshot>(key, box);
  return s && s.v === 1 && Array.isArray(s.visits) && s.lab ? s : null;
}
