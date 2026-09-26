/**
 * Lab code on this device (client side). The signed license is verified offline on every open;
 * when online it is refreshed from the server at most every few hours (extension, station
 * changes, stop). Devices activated before lab codes existed keep working for 30 days.
 */
import { ACT_KEY, ACTIVATION_SCRIPT } from "@/lib/local/activation";
import type { LicenseModule, LicensePayload } from "./modules";

const DEVICE_KEY = "local.device.v1";
const LIC_KEY = "local.license.v1";
const GRACE_KEY = "local.license.grace.v1";
const SEEN_KEY = "local.license.seen.v1";
const ENABLED_KEY = "local.license.enabled";
const CONTACT_KEY = "local.license.contact";

const DAY = 86_400_000;
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

/** Ask the server whether lab codes are on (cached for offline opens). */
export async function fetchEnabled(): Promise<boolean> {
  try {
    const r = await fetch("/api/license", { cache: "no-store" });
    const d = (await r.json()) as { enabled: boolean; contact?: string };
    write(ENABLED_KEY, d.enabled ? "1" : "0");
    write(CONTACT_KEY, d.contact ?? "");
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

function store(d: { token: string; pub: JsonWebKey; now?: number; message?: string }) {
  write(LIC_KEY, JSON.stringify({ token: d.token, pub: d.pub, checkedAt: Date.now(), message: d.message || "" } satisfies Stored));
  write(ACT_KEY, "activated");
  if (d.now) write(SEEN_KEY, String(d.now)); // the server's clock resets a wrongly set one
}

export type ActivateResult = { ok: true } | { ok: false; error: string; lab?: string };

/** Enter a lab code on this device (also used to renew with a new code). */
export async function activateCode(code: string): Promise<ActivateResult> {
  try {
    const r = await fetch("/api/license/activate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, device: deviceId(), label: deviceLabel() }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) { store(d); return { ok: true }; }
    return { ok: false, error: d.error ?? "error", lab: d.lab };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Refresh from the server when online (at most every few hours unless forced). */
export async function refreshLicense(force = false): Promise<void> {
  const s = readJson<Stored>(LIC_KEY);
  if (!s || (!force && Date.now() - s.checkedAt < REFRESH_MS)) return;
  const p = await verify(s);
  if (!p) return;
  try {
    const r = await fetch("/api/license/check", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lid: p.lid, device: deviceId() }),
    });
    const d = await r.json().catch(() => null);
    if (!d || d.error === "disabled" || d.error === "bad_request") return;
    if (d.ok) store(d);
    else write(LIC_KEY, JSON.stringify({ ...s, checkedAt: Date.now(), blocked: { error: d.error, at: Date.now() } } satisfies Stored));
  } catch { /* offline — try again next time */ }
}

/** The provider's current note for this lab (empty when none). */
export function providerMessage(): string {
  return readJson<Stored>(LIC_KEY)?.message?.trim() ?? "";
}
