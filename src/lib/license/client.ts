/**
 * Lab code on this device (client side). The signed license is verified offline on every open;
 * when online it is refreshed from the server at most every few hours (extension, station
 * changes, stop). Devices activated before lab codes existed keep working for 30 days.
 */
import { ACT_KEY, ACTIVATION_SCRIPT } from "@/lib/local/activation";
import type { LicenseModule, LicensePayload } from "./modules";
import type { DeviceSync } from "@/lib/sync/protocol";
import { applyPinOp, type PinOp } from "@/lib/local/pin";

const DEVICE_KEY = "local.device.v1";
const LIC_KEY = "local.license.v1";
const GRACE_KEY = "local.license.grace.v1";
const SEEN_KEY = "local.license.seen.v1";
const ENABLED_KEY = "local.license.enabled";
const CONTACT_KEY = "local.license.contact";
const SIGNUP_KEY = "local.license.signup";

const DAY = 86_400_000;
/** This app's version (set at build, next.config): sent with every check, shown in /licenses. */
export const APP_VERSION = process.env.LAB_VERSION ?? "";
/** The errors after which the server really refuses this device (anything else: try again later). */
const REFUSED = new Set(["not_found", "other_device", "stopped", "expired"]);
export const GRACE_DAYS = 30;
export const WARN_DAYS = 14;
const REFRESH_MS = 6 * 3600_000;
const CLOCK_SLACK = 12 * 3600_000;

interface Stored {
  token: string;
  pub: JsonWebKey;
  checkedAt: number;
  /** Note from the provider, shown on the stations until dismissed. */
  message?: string;
  /** Set when the server said the code no longer works (stopped / deleted / moved / expired). */
  blocked?: { error: string; at: number };
  /** The app version last reported to the server — a new version reports at once. */
  version?: string;
  /** The lab's own database, when the code is linked to one (see lib/sync). */
  sync?: DeviceSync | null;
}

export type LicenseState =
  | { kind: "off" }
  | { kind: "ok"; lab: string; until: number; mods: LicenseModule[] }
  | { kind: "grace"; until: number }
  | { kind: "need" }
  | { kind: "locked"; reason: "expired" | "stopped" | "grace_over" | "clock" | "gone"; lab?: string; until?: number }
  | { kind: "module_off"; lab: string; module: LicenseModule };

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const readJson = <T,>(k: string): T | null => { try { return JSON.parse(read(k) ?? "null") as T; } catch { return null; } };

export function deviceId(): string {
  let id = read(DEVICE_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    write(DEVICE_KEY, id);
  }
  return id;
}
function deviceLabel(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "جهاز";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "متصفح";
  return `${os} · ${br}`;
}

export const cachedContact = () => read(CONTACT_KEY) ?? "";
export const cachedEnabled = () => read(ENABLED_KEY) === "1";
/** Can a lab register itself here (the owner's «التسجيل الذاتي»)? */
export const cachedSignup = () => read(SIGNUP_KEY) === "1";

/** Ask the server whether lab codes are on (cached for offline opens). A server that is down
 *  or answers with an error changes nothing: the last answer keeps being used. */
export async function fetchEnabled(): Promise<boolean> {
  try {
    const r = await fetch("/api/license", { cache: "no-store" });
    const d = r.ok ? ((await r.json()) as { enabled?: unknown; contact?: unknown; signup?: unknown }) : null;
    if (!d || typeof d.enabled !== "boolean") return cachedEnabled();
    write(ENABLED_KEY, d.enabled ? "1" : "0");
    write(SIGNUP_KEY, d.signup === true ? "1" : "0");
    write(CONTACT_KEY, typeof d.contact === "string" ? d.contact : "");
    return d.enabled;
  } catch {
    return cachedEnabled();
  }
}

async function verify(s: Stored): Promise<LicensePayload | null> {
  try {
    const { importJWK, jwtVerify } = await import("jose");
    const key = await importJWK(s.pub as never, "ES256");
    const { payload } = await jwtVerify(s.token, key, { algorithms: ["ES256"] });
    return payload as unknown as LicensePayload;
  } catch {
    return null;
  }
}

/** Remember the latest time seen, so turning the clock back cannot extend a period. */
function clockNow(): { now: number; rolledBack: boolean } {
  const real = Date.now();
  const seen = Number(read(SEEN_KEY) ?? 0);
  if (real > seen) write(SEEN_KEY, String(real));
  return { now: Math.max(real, seen), rolledBack: seen - real > CLOCK_SLACK };
}

/** The state of this device for a station (or the Welcome page when no module is given). */
export async function evaluate(module?: LicenseModule): Promise<LicenseState> {
  if (!cachedEnabled()) return { kind: "off" };
  if (!read(ACT_KEY)) { try { new Function(ACTIVATION_SCRIPT)(); } catch { /* ignore */ } }
  const { now, rolledBack } = clockNow();
  const s = readJson<Stored>(LIC_KEY);
  if (s) {
    const p = await verify(s);
    if (p && p.dev === deviceId()) {
      if (rolledBack) return { kind: "locked", reason: "clock", lab: p.lab, until: p.until };
      if (s.blocked) {
        const reason = s.blocked.error === "expired" ? "expired" : s.blocked.error === "stopped" ? "stopped" : "gone";
        return { kind: "locked", reason, lab: p.lab, until: p.until };
      }
      if (p.until <= now) return { kind: "locked", reason: "expired", lab: p.lab, until: p.until };
      if (module && !p.mods.includes(module)) return { kind: "module_off", lab: p.lab, module };
      return { kind: "ok", lab: p.lab, until: p.until, mods: p.mods };
    }
  }
  // Activated before lab codes (or by the old shared code): 30 days, counted from the first open after the update.
  const act = read(ACT_KEY);
  if (act === "legacy" || act === "activated" || act === "grace") {
    let start = Number(read(GRACE_KEY) ?? 0);
    if (!start && act !== "grace") { start = Date.now(); write(GRACE_KEY, String(start)); }
    write(ACT_KEY, "grace");
    const until = start + GRACE_DAYS * DAY;
    if (rolledBack) return { kind: "locked", reason: "clock" };
    if (!start || until <= now) return { kind: "locked", reason: "grace_over" };
    if (module === "admin") return { kind: "module_off", lab: "", module };
    return { kind: "grace", until };
  }
  return { kind: "need" };
}

function store(d: { token: string; pub: JsonWebKey; now?: number; message?: string; sync?: DeviceSync | null; pin?: PinOp | null }) {
  write(LIC_KEY, JSON.stringify({ token: d.token, pub: d.pub, checkedAt: Date.now(), message: d.message || "", version: APP_VERSION, sync: d.sync ?? null } satisfies Stored));
  applyPinOp(d.pin); // the owner's «رمز دخول المحطات» change, once
  write(ACT_KEY, "activated");
  if (d.now) write(SEEN_KEY, String(d.now)); // the server's clock resets a wrongly set one
}

export type ActivateResult = { ok: true } | { ok: false; error: string; lab?: string };

/** Enter a lab code on this device (also used to renew with a new code). */
export async function activateCode(code: string): Promise<ActivateResult> {
  try {
    const r = await fetch("/api/license/activate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, device: deviceId(), label: deviceLabel(), version: APP_VERSION }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) { store(d); return { ok: true }; }
    return { ok: false, error: d.error ?? "error", lab: d.lab };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Refresh from the server when online (at most every few hours unless forced, or at once after
 *  an app update so the owner sees the new version). A server that is down, slow or answering
 *  with an error changes nothing — only a real refusal (stopped, expired, moved, deleted) locks. */
export async function refreshLicense(force = false, maxAge = REFRESH_MS): Promise<void> {
  const s = readJson<Stored>(LIC_KEY);
  if (!s || (!force && Date.now() - s.checkedAt < maxAge && s.version === APP_VERSION)) return;
  const p = await verify(s);
  if (!p) return;
  try {
    const r = await fetch("/api/license/check", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lid: p.lid, device: deviceId(), version: APP_VERSION }),
    });
    const d = await r.json().catch(() => null);
    if (!d) return;
    if (d.ok === true && typeof d.token === "string" && d.pub) store(d);
    else if ((r.status === 403 || r.status === 404) && REFUSED.has(d.error)) {
      write(LIC_KEY, JSON.stringify({ ...s, checkedAt: Date.now(), blocked: { error: d.error, at: Date.now() } } satisfies Stored));
    }
  } catch { /* offline — try again next time */ }
}

/** The provider's current note for this lab (empty when none). */
export function providerMessage(): string {
  return readJson<Stored>(LIC_KEY)?.message?.trim() ?? "";
}

/** When this device last heard from the server about its code (null: never / no code). */
export function licenseCheckedAt(): number | null {
  const s = readJson<Stored>(LIC_KEY);
  return s?.checkedAt ?? null;
}

/** The lab's database this code is linked to (set in /licenses, or by the lab from its settings). */
export function licenseSync(): DeviceSync | null {
  const s = readJson<Stored>(LIC_KEY);
  return s && !s.blocked ? s.sync ?? null : null;
}
/** Who this device is to the server (for the lab-database calls): its code's id and device id. */
export async function licenseIdentity(): Promise<{ lid: string; device: string } | null> {
  const s = readJson<Stored>(LIC_KEY);
  if (!s || s.blocked) return null;
  const p = await verify(s);
  return p && p.dev === deviceId() ? { lid: p.lid, device: p.dev } : null;
}
