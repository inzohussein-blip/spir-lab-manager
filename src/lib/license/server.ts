import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair, importJWK, type JWK, type KeyLike } from "jose";
import { mainQuery as appQuery } from "@/lib/db";
import { cleanModules, DEFAULT_MODULES, type LicenseModule, type LicensePayload } from "./modules";
import { licenseDbUrl } from "./env";
import { newTotpSecret, totpMatch, totpUri } from "./totp";
import { providerOf, type ProviderId } from "@/lib/db/providers";
import { connHost, isPostgresUrl, isSupabaseUrl, type DeviceSync, type SyncConfig } from "@/lib/sync/protocol";
export { licenseDbUrl, durableStorage, passwordSet, licensingEnabled, licenseStorage } from "./env";

/**
 * Lab codes («منظومة الرموز»): one code per lab, bound to one device on first use, valid for a
 * number of days counted from that activation, with the stations (and the full admin panel)
 * it may open. The code itself is stored only as a hash.
 *
 * A device gets a license signed with an ES256 key kept in the database, sealed with AUTH_SECRET;
 * the stations verify it offline and refresh it from the server when online (extension, station changes, stop).
 * Switched on by setting LICENSE_ADMIN_PASSWORD (the owner's password for /licenses).
 */

// TLS is set below (always verified); the URL's own sslmode (Neon adds "require") would only
// change meaning in pg v9, so it is dropped here.
function withoutSslMode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    return u.toString();
  } catch {
    return url;
  }
}
type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
const g = globalThis as unknown as { __licensePool?: Promise<Pool> };
function licensePool(url: string): Promise<Pool> {
  g.__licensePool ??= import("pg").then(({ Pool }) => new Pool({
    connectionString: withoutSslMode(url),
    max: Number(process.env.LICENSE_PGPOOL_MAX || 3),
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
  }) as unknown as Pool);
  return g.__licensePool;
}
async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const url = licenseDbUrl();
  if (!url) return appQuery<T>(sql, params);
  return (await (await licensePool(url)).query(sql, params)).rows as T[];
}
async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  return (await query<T>(sql, params))[0] ?? null;
}
const DAY = 86_400_000;

export interface LicenseRow {
  id: string;
  lab_name: string;
  note: string;
  code_hint: string;
  duration_days: number;
  modules: LicenseModule[];
  status: "active" | "stopped";
  device_id: string | null;
  device_label: string | null;
  activated_at: number | null;
  expires_at: number | null;
  last_seen_at: number | null;
  created_at: number;
  /** Owner's bookkeeping: subscription amount (free text) and whether it is paid. */
  price: string;
  paid: boolean;
  paid_at: number | null;
  /** Note shown on the lab's stations at their next online check. */
  message: string;
  /** Owner's name for the device (e.g. «حاسوب الاستقبال»). */
  device_name: string;
  is_trial: boolean;
  /** The app version the device last reported (empty: a version from before this was sent). */
  app_version: string;
  /** The lab's own database, when linked (no secrets: kind, where, and who set it). */
  sync: SyncInfo | null;
  /** What the device last reported about its sync: last success, records waiting, last error. */
  sync_last_at: number | null;
  sync_pending: number;
  sync_error: string;
  sync_reported_at: number | null;
  /** The full admin panel's own database, when set (no secrets: where, who set it, when). */
  admin_db: AdminDbInfo | null;
  /** The last check of that database (by the owner, or the lab's panel in use). */
  admin_db_check: { at: number; ok: boolean; error: string } | null;
  /** How many devices may use the code (with «حساب واحد بعدة أجهزة» on; the first is device_id). */
  max_devices: number;
  /** The devices beyond the first one. */
  devices: ExtraDevice[];
  /** "signup": created by the lab itself («التسجيل الذاتي»); "" by the owner. */
  source: string;
}
export interface ExtraDevice { device_id: string; label: string; activated_at: number; last_seen_at: number | null; app_version: string }
export interface AdminDbInfo { host: string; by: "owner" | "lab"; at: number; provider?: ProviderId }
export interface SyncInfo { kind: SyncConfig["kind"]; host: string; by: "owner" | "device"; at: number }

export interface LicenseEvent { license_id: string; at: number; kind: string; detail: string }

// ── Tables (created on first use; see migration 0015) ─────────────────────────
let ensured: Promise<unknown> | null = null;
function ensureTables() {
  ensured ??= (async () => {
    await query(`create table if not exists station_licenses (
      id text primary key,
      code_hash text unique not null,
      code_hint text not null default '',
      lab_name text not null,
      note text not null default '',
      duration_days integer not null,
      modules text not null default '[]',
      status text not null default 'active',
      device_id text,
      device_label text,
      activated_at bigint,
      expires_at bigint,
      last_seen_at bigint,
      created_at bigint not null)`);
    await query(`create table if not exists license_config (key text primary key, value text not null default '')`);
    // Added after the first release (0016).
    for (const col of [
      "price text not null default ''", "paid boolean not null default false", "paid_at bigint",
      "message text not null default ''", "device_name text not null default ''", "is_trial boolean not null default false",
      "app_version text not null default ''", // 0018
      "sync_config text not null default ''", "sync_info text not null default ''", // 0019
      "sync_last_at bigint", "sync_pending integer not null default 0", "sync_error text not null default ''", "sync_reported_at bigint", // 0020
      "admin_db text not null default ''", "admin_db_info text not null default ''", // 0021
      "admin_db_check_at bigint", "admin_db_ok boolean", "admin_db_error text not null default ''", // 0022
      "max_devices integer not null default 1", "source text not null default ''", // 0024
    ]) await query(`alter table station_licenses add column if not exists ${col}`);
    await query(`create table if not exists license_events (
      id text primary key, license_id text not null, at bigint not null, kind text not null, detail text not null default '')`);
    await query(`create index if not exists license_events_license on license_events (license_id, at desc)`);
    // Wrong-code / wrong-password attempts (shared by every server instance) and the owner's sign-ins (0017).
    await query(`create table if not exists license_attempts (id text primary key, k text not null, at bigint not null)`);
    await query(`create index if not exists license_attempts_k on license_attempts (k, at)`);
    // The extra devices of a code (0024) and the error log (0024).
    await query(`create table if not exists license_devices (
      license_id text not null, device_id text not null, label text not null default '', activated_at bigint not null,
      last_seen_at bigint, app_version text not null default '', primary key (license_id, device_id))`);
    await query(`create table if not exists license_errors (
      id text primary key, at bigint not null, license_id text, kind text not null default '', path text not null default '',
      message text not null default '', digest text not null default '', agent text not null default '')`);
    await query(`create index if not exists license_errors_at on license_errors (at desc)`);
    await query(`create table if not exists license_owner_log (
      id text primary key, at bigint not null, ok boolean not null, ip text not null default '', agent text not null default '')`);
  })().catch((e) => { ensured = null; throw e; });
  return ensured;
}

async function getConfig(key: string): Promise<string | null> {
  await ensureTables();
  return (await queryOne<{ value: string }>(`select value from license_config where key = $1`, [key]))?.value ?? null;
}
async function setConfig(key: string, value: string) {
  await ensureTables();
  await query(`insert into license_config (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`, [key, value]);
}

// ── The owner's settings («الإعدادات العامة» in /licenses) ─────────────────────────
export interface OwnerPrefs {
  /** What a new code starts with in «رمز جديد». */
  defaultDays: number;
  defaultModules: LicenseModule[];
  /** Length of a trial code. */
  trialDays: number;
  /** A code is «قارب على الانتهاء» this many days before its end. */
  soonDays: number;
  /** The full admin panel opens for a paid code only once it has a database of its own
   *  (trial codes work in their own section of the site's database). */
  adminNeedsOwnDb: boolean;
  /** One code for several devices of the same lab (its number set per code). Off by default. */
  multiDevice: boolean;
  /** A lab can register itself and get a trial code (/signup). Off by default. */
  selfSignup: boolean;
  /** Errors on the site and the stations are kept for the owner («سجل الأخطاء»). Off by default. */
  errorLog: boolean;
  /** The owner can export a lab's admin-panel data (hidden until switched on). Off by default. */
  dataExport: boolean;
}
export const DEFAULT_PREFS: OwnerPrefs = {
  defaultDays: 365, defaultModules: [...DEFAULT_MODULES], trialDays: 7, soonDays: 14, adminNeedsOwnDb: true,
  multiDevice: false, selfSignup: false, errorLog: false, dataExport: false,
};
const within = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
};
export function cleanPrefs(v: unknown): OwnerPrefs {
  const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    defaultDays: within(p.defaultDays, 1, 3650, DEFAULT_PREFS.defaultDays),
    defaultModules: Array.isArray(p.defaultModules) ? cleanModules(p.defaultModules) : [...DEFAULT_PREFS.defaultModules],
    trialDays: within(p.trialDays, 1, 60, DEFAULT_PREFS.trialDays),
    soonDays: within(p.soonDays, 1, 90, DEFAULT_PREFS.soonDays),
    adminNeedsOwnDb: typeof p.adminNeedsOwnDb === "boolean" ? p.adminNeedsOwnDb : DEFAULT_PREFS.adminNeedsOwnDb,
    multiDevice: p.multiDevice === true,
    selfSignup: p.selfSignup === true,
    errorLog: p.errorLog === true,
    dataExport: p.dataExport === true,
  };
}
export async function getPrefs(): Promise<OwnerPrefs> {
  try { return cleanPrefs(JSON.parse((await getConfig("owner_prefs")) || "{}")); } catch { return cleanPrefs({}); }
}
export async function setPrefs(v: unknown): Promise<OwnerPrefs> {
  const p = cleanPrefs(v);
  await setConfig("owner_prefs", JSON.stringify(p));
  return p;
}

/** Shown on the activation / lock screens when the owner has not written a contact line. */
export const DEFAULT_CONTACT = "للتفعيل والتجديد والدعم الفني: 07803993585";
export async function getContact(): Promise<string> {
  const saved = ((await getConfig("contact").catch(() => null)) ?? "").trim();
  return saved || (process.env.STATION_ACTIVATION_CONTACT ?? "").trim() || DEFAULT_CONTACT;
}
export async function setContact(v: string) { await setConfig("contact", v.trim().slice(0, 300)); }

// ── Signing key (generated once, kept in the database encrypted with AUTH_SECRET) ─────
// A copy of the database alone cannot sign licenses: the private key is sealed with AES-256-GCM
// under a key derived from AUTH_SECRET, which lives only in the server's environment.
// A key found stored in the clear (older versions), or one that no longer opens (AUTH_SECRET
// changed), is replaced by a new one; devices keep their current license offline and receive
// the new public key with their next online check.
type SealedKey = { v: 1; pub: JWK; iv: string; tag: string; data: string };
type PlainKey = { priv: JWK; pub: JWK };
const sealSecret = () => (process.env.AUTH_SECRET ?? "").trim();
const sealKey = (secret: string) => createHash("sha256").update(`lic-signing-key:${secret}`).digest();
type Sealed = { iv: string; tag: string; data: string };
function sealText(text: string, secret: string, aad: string): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(secret), iv);
  c.setAAD(Buffer.from(aad));
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}
function unsealText(s: Sealed, secret: string, aad: string): string | null {
  try {
    const d = createDecipheriv("aes-256-gcm", sealKey(secret), Buffer.from(s.iv, "base64"));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(Buffer.from(s.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}
const seal = (priv: JWK, pub: JWK, secret: string): SealedKey => ({ v: 1, pub, ...sealText(JSON.stringify(priv), secret, JSON.stringify(pub)) });
function unseal(s: SealedKey, secret: string): JWK | null {
  const t = unsealText(s, secret, JSON.stringify(s.pub));
  try { return t ? (JSON.parse(t) as JWK) : null; } catch { return null; }
}
/** Read the stored key: the private key when usable, and whether it is sealed. */
function openStored(raw: string, secret: string): { priv: JWK | null; pub: JWK; sealed: boolean } | null {
  try {
    const v = JSON.parse(raw) as SealedKey | PlainKey;
    if ("data" in v) return { priv: secret ? unseal(v, secret) : null, pub: v.pub, sealed: true };
    // A key stored in the clear is only kept while there is nothing to seal it with.
    return { priv: secret ? null : v.priv, pub: v.pub, sealed: false };
  } catch { return null; }
}
let keys: Promise<{ priv: KeyLike | Uint8Array; pub: JWK }> | null = null;
function signingKeys() {
  keys ??= (async () => {
    const secret = sealSecret();
    const saved = await getConfig("signing_key");
    const cur = saved ? openStored(saved, secret) : null;
    if (cur?.priv) return { priv: await importJWK(cur.priv, "ES256"), pub: cur.pub };
    const kp = await generateKeyPair("ES256", { extractable: true });
    const priv = await exportJWK(kp.privateKey), pub = await exportJWK(kp.publicKey);
    const value = JSON.stringify(secret ? seal(priv, pub, secret) : { priv, pub });
    // Replace only what was read, so parallel server instances settle on one key.
    if (saved == null) await query(`insert into license_config (key, value) values ('signing_key', $1) on conflict (key) do nothing`, [value]);
    else await query(`update license_config set value = $1 where key = 'signing_key' and value = $2`, [value, saved]);
    const stored = openStored((await getConfig("signing_key"))!, secret);
    if (!stored?.priv) throw new Error("signing key unavailable");
    return { priv: await importJWK(stored.priv, "ES256"), pub: stored.pub };
  })().catch((e) => { keys = null; throw e; });
  return keys;
}
/** For the owner's page: is the stored signing key sealed with AUTH_SECRET? */
export async function signingKeySealed(): Promise<boolean> {
  try {
    await signingKeys();
    const raw = await getConfig("signing_key");
    return !!raw && !!openStored(raw, sealSecret())?.sealed;
  } catch { return false; }
}
export async function publicKey(): Promise<JWK> { return (await signingKeys()!).pub; }

async function signLicense(p: Omit<LicensePayload, "iat">): Promise<string> {
  const { priv } = await signingKeys()!;
  return new SignJWT({ ...p }).setProtectedHeader({ alg: "ES256" }).setIssuedAt().sign(priv);
}

// ── Two-step sign-in for the owner (authenticator app) ────────────────────────
// The shared secret is kept sealed with AUTH_SECRET like the signing key. LICENSE_2FA_OFF=1 in the
// server's environment switches the second step off (lost phone); set it up again, then remove it.
const TOTP_AAD = "owner-totp";
export const twoFactorForcedOff = () => process.env.LICENSE_2FA_OFF === "1";
async function readTotp(key: "owner_totp" | "owner_totp_pending"): Promise<string | null> {
  const raw = await getConfig(key).catch(() => null);
  const secret = sealSecret();
  if (!raw || !secret) return null;
  try { return unsealText(JSON.parse(raw) as Sealed, secret, TOTP_AAD); } catch { return null; }
}
/** enabled: set up and readable; broken: set up, but AUTH_SECRET changed since (it no longer opens — set up again). */
export async function twoFactorStatus(): Promise<{ enabled: boolean; broken: boolean; forcedOff: boolean; canSetup: boolean }> {
  const stored = !!(await getConfig("owner_totp").catch(() => null));
  const enabled = stored && (await readTotp("owner_totp")) != null;
  return { enabled, broken: stored && !enabled, forcedOff: twoFactorForcedOff(), canSetup: !!sealSecret() };
}
/** Is a second step needed to sign in now? */
export async function twoFactorRequired(): Promise<boolean> {
  return !twoFactorForcedOff() && (await readTotp("owner_totp")) != null;
}
/** A code is accepted once: a step already used (or older) is refused. */
async function consumeCode(secret: string, code: string): Promise<boolean> {
  const step = totpMatch(secret, code);
  if (step == null) return false;
  const last = Number((await getConfig("owner_totp_last")) ?? 0);
  if (step <= last) return false;
  await setConfig("owner_totp_last", String(step));
  return true;
}
export async function checkOwnerCode(code: string): Promise<boolean> {
  const secret = await readTotp("owner_totp");
  return !!secret && (await consumeCode(secret, code));
}
/** Start setting up: a new secret, kept aside until a first code from the phone confirms it. */
export async function startTwoFactorSetup(): Promise<{ secret: string; uri: string } | null> {
  const key = sealSecret();
  if (!key) return null;
  const secret = newTotpSecret();
  await setConfig("owner_totp_pending", JSON.stringify(sealText(secret, key, TOTP_AAD)));
  return { secret, uri: totpUri(secret, "owner", "Lab codes") };
}
export async function confirmTwoFactor(code: string): Promise<boolean> {
  const secret = await readTotp("owner_totp_pending");
  if (!secret || !(await consumeCode(secret, code))) return false;
  await setConfig("owner_totp", (await getConfig("owner_totp_pending"))!);
  await query(`delete from license_config where key = 'owner_totp_pending'`);
  return true;
}
/** Turn it off: needs a current code, unless it was switched off from the environment. */
export async function disableTwoFactor(code: string): Promise<boolean> {
  if (!twoFactorForcedOff() && !(await checkOwnerCode(code))) return false;
  await query(`delete from license_config where key in ('owner_totp', 'owner_totp_pending')`);
  return true;
}

// ── Codes ─────────────────────────────────────────────────────────────────────
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, "");
const hashCode = (c: string) => createHash("sha256").update("lab-code:" + normalizeCode(c)).digest("hex");
function newCode(): string {
  const b = randomBytes(12);
  const s = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

type Raw = Omit<LicenseRow, "modules" | "activated_at" | "expires_at" | "last_seen_at" | "created_at" | "paid_at" | "paid" | "is_trial"> & {
  modules: string; activated_at: string | number | null; expires_at: string | number | null; last_seen_at: string | number | null; created_at: string | number;
  paid_at: string | number | null; paid: boolean | string; is_trial: boolean | string; app_version: string | null; sync_info?: string | null; admin_db_info?: string | null;
  admin_db_check_at?: string | number | null; admin_db_ok?: boolean | string | null; admin_db_error?: string | null;
  max_devices?: string | number | null; source?: string | null;
  sync_last_at?: string | number | null; sync_pending?: string | number | null; sync_error?: string | null; sync_reported_at?: string | number | null;
};
const COLS = `id, lab_name, note, code_hint, duration_days, modules, status, device_id, device_label,
  activated_at, expires_at, last_seen_at, created_at, price, paid, paid_at, message, device_name, is_trial, app_version, sync_info,
  sync_last_at, sync_pending, sync_error, sync_reported_at, admin_db_info, admin_db_check_at, admin_db_ok, admin_db_error, max_devices, source`;
const bool = (v: boolean | string) => v === true || v === "t" || v === "true";
const num = (v: string | number | null) => (v == null ? null : Number(v));
function toRow({ sync_info, admin_db_info, admin_db_check_at, admin_db_ok, admin_db_error, max_devices, source, ...r }: Raw, devices: ExtraDevice[] = []): LicenseRow {
  let mods: unknown = [];
  try { mods = JSON.parse(r.modules); } catch { /* keep empty */ }
  let sync: SyncInfo | null = null;
  try { sync = sync_info ? (JSON.parse(sync_info) as SyncInfo) : null; } catch { /* none */ }
  let admin_db: AdminDbInfo | null = null;
  try { admin_db = admin_db_info ? (JSON.parse(admin_db_info) as AdminDbInfo) : null; } catch { /* none */ }
  return {
    ...r, sync, admin_db,
    max_devices: Math.max(1, Number(max_devices ?? 1) || 1), devices, source: source ?? "",
    admin_db_check: admin_db && admin_db_check_at != null ? { at: Number(admin_db_check_at), ok: bool(admin_db_ok ?? false), error: admin_db_error ?? "" } : null, duration_days: Number(r.duration_days), modules: cleanModules(mods),
    activated_at: num(r.activated_at), expires_at: num(r.expires_at), last_seen_at: num(r.last_seen_at), created_at: Number(r.created_at),
    paid_at: num(r.paid_at), paid: bool(r.paid), is_trial: bool(r.is_trial),
    price: r.price ?? "", message: r.message ?? "", device_name: r.device_name ?? "", app_version: r.app_version ?? "",
    sync_last_at: num(r.sync_last_at ?? null), sync_pending: Number(r.sync_pending ?? 0), sync_error: r.sync_error ?? "", sync_reported_at: num(r.sync_reported_at ?? null),
  };
}

type RawDevice = { license_id: string; device_id: string; label: string; activated_at: string | number; last_seen_at: string | number | null; app_version: string };
const toDevice = (d: RawDevice): ExtraDevice => ({
  device_id: d.device_id, label: d.label, activated_at: Number(d.activated_at), last_seen_at: num(d.last_seen_at), app_version: d.app_version ?? "",
});
export async function listLicenses(): Promise<LicenseRow[]> {
  await ensureTables();
  const rows = await query<Raw>(`select ${COLS} from station_licenses order by created_at desc`);
  const devs = await query<RawDevice>(`select * from license_devices order by activated_at`);
  const by = new Map<string, ExtraDevice[]>();
  for (const d of devs) by.set(d.license_id, [...(by.get(d.license_id) ?? []), toDevice(d)]);
  return rows.map((r) => toRow(r, by.get(r.id) ?? []));
}
async function getLicense(id: string): Promise<LicenseRow | null> {
  await ensureTables();
  const r = await queryOne<Raw>(`select ${COLS} from station_licenses where id = $1`, [id]);
  if (!r) return null;
  const devs = await query<RawDevice>(`select * from license_devices where license_id = $1 order by activated_at`, [id]);
  return toRow(r, devs.map(toDevice));
}
/** May this device use the code? Its first device, or one of its extra devices while the owner
 *  allows several devices per code. */
async function deviceAllowed(row: LicenseRow, device: string): Promise<"main" | "extra" | false> {
  if (!device) return false;
  if (row.device_id === device) return "main";
  if (!row.devices.some((d) => d.device_id === device)) return false;
  return (await getPrefs()).multiDevice && row.max_devices > 1 ? "extra" : false;
}

/** A code's lab name (for files and messages), or null when there is no such code. */
export async function licenseLabName(id: string): Promise<string | null> {
  return (await getLicense(id))?.lab_name ?? null;
}
/** Note an owner action in a code's history. */
export async function noteLicenseEvent(id: string, kind: string, detail = "") { await logEvent(id, kind, detail); }

// ── History («سجل الرمز») ──────────────────────────────────────────────────────
async function logEvent(licenseId: string, kind: string, detail = "") {
  try {
    await query(`insert into license_events (id, license_id, at, kind, detail) values ($1, $2, $3, $4, $5)`,
      [randomUUID(), licenseId, Date.now(), kind, detail.slice(0, 300)]);
  } catch { /* history never blocks the action */ }
}
/** Latest events of every code (newest first), for the owner page. */
export async function listEvents(limit = 2000): Promise<LicenseEvent[]> {
  await ensureTables();
  const rows = await query<{ license_id: string; at: string | number; kind: string; detail: string }>(
    `select license_id, at, kind, detail from license_events order by at desc limit $1`, [limit]);
  return rows.map((r) => ({ ...r, at: Number(r.at) }));
}

export async function createLicense(v: { lab: string; days: number; modules: unknown; note?: string; trial?: boolean; maxDevices?: number; source?: string }): Promise<{ row: LicenseRow; code: string }> {
  await ensureTables();
  const code = newCode();
  const id = randomUUID();
  const days = Math.max(1, Math.min(3650, Math.round(v.days)));
  await query(
    `insert into station_licenses (id, code_hash, code_hint, lab_name, note, duration_days, modules, created_at, is_trial, max_devices, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, hashCode(code), code.slice(-4), v.lab.trim().slice(0, 120), (v.note ?? "").trim().slice(0, 300), days, JSON.stringify(cleanModules(v.modules)), Date.now(), !!v.trial,
      Math.max(1, Math.min(50, Math.round(Number(v.maxDevices) || 1))), v.source === "signup" ? "signup" : ""],
  );
  await logEvent(id, "created", `${v.source === "signup" ? "تسجيل ذاتي — " : ""}${v.trial ? "رمز تجريبي — " : ""}${days} يوم`);
  return { row: (await getLicense(id))!, code };
}

export type LicenseAction =
  | { action: "extend"; days: number }
  | { action: "stop" } | { action: "resume" }
  | { action: "reset_device" }
  | { action: "modules"; modules: unknown }
  | { action: "rename"; lab: string; note?: string }
  | { action: "new_code" }
  | { action: "delete" }
  | { action: "payment"; price: string; paid: boolean }
  | { action: "message"; text: string }
  | { action: "device_name"; name: string }
  | { action: "max_devices"; n: number }
  | { action: "remove_device"; device: string };

/** Owner actions from /licenses. Returns the new code for "new_code". */
export async function updateLicense(id: string, a: LicenseAction): Promise<{ row: LicenseRow | null; code?: string }> {
  const cur = await getLicense(id);
  if (!cur) return { row: null };
  switch (a.action) {
    case "extend": {
      const days = Math.max(1, Math.min(3650, Math.round(a.days)));
      if (cur.expires_at == null) {
        await query(`update station_licenses set duration_days = duration_days + $2 where id = $1`, [id, days]);
        await logEvent(id, "extended", `+${days} يوم (قبل التفعيل)`);
      } else {
        const until = Math.max(cur.expires_at, Date.now()) + days * DAY;
        await query(`update station_licenses set expires_at = $2 where id = $1`, [id, until]);
        await logEvent(id, "extended", `+${days} يوم — حتى ${new Date(until).toLocaleDateString("en-CA")}`);
      }
      break;
    }
    case "stop": await query(`update station_licenses set status = 'stopped' where id = $1`, [id]); await logEvent(id, "stopped"); break;
    case "resume": await query(`update station_licenses set status = 'active' where id = $1`, [id]); await logEvent(id, "resumed"); break;
    case "reset_device":
      await query(`update station_licenses set device_id = null, device_label = null, device_name = '' where id = $1`, [id]);
      await query(`delete from license_devices where license_id = $1`, [id]);
      await logEvent(id, "device_reset", cur.device_name || cur.device_label || "");
      break;
    case "modules": {
      const mods = cleanModules(a.modules);
      await query(`update station_licenses set modules = $2 where id = $1`, [id, JSON.stringify(mods)]);
      await logEvent(id, "modules", mods.join(","));
      break;
    }
    case "rename":
      await query(`update station_licenses set lab_name = $2, note = $3 where id = $1`, [id, a.lab.trim().slice(0, 120) || cur.lab_name, (a.note ?? cur.note).trim().slice(0, 300)]);
      await logEvent(id, "renamed", a.lab.trim().slice(0, 120) || cur.lab_name);
      break;
    case "payment": {
      const price = String(a.price ?? "").trim().slice(0, 40);
      const paid = !!a.paid;
      await query(`update station_licenses set price = $2, paid = $3, paid_at = $4 where id = $1`, [id, price, paid, paid ? (cur.paid ? cur.paid_at : Date.now()) : null]);
      if (paid !== cur.paid || price !== cur.price) await logEvent(id, paid ? "paid" : "unpaid", price);
      break;
    }
    case "message": {
      const text = String(a.text ?? "").trim().slice(0, 300);
      await query(`update station_licenses set message = $2 where id = $1`, [id, text]);
      await logEvent(id, "message", text || "—");
      break;
    }
    case "device_name":
      await query(`update station_licenses set device_name = $2 where id = $1`, [id, String(a.name ?? "").trim().slice(0, 60)]);
      break;
    case "max_devices": {
      const n = Math.max(1, Math.min(50, Math.round(Number(a.n) || 1)));
      await query(`update station_licenses set max_devices = $2 where id = $1`, [id, n]);
      await logEvent(id, "max_devices", String(n));
      break;
    }
    case "remove_device": {
      const d = cur.devices.find((x) => x.device_id === a.device);
      if (d) {
        await query(`delete from license_devices where license_id = $1 and device_id = $2`, [id, d.device_id]);
        await logEvent(id, "device_removed", d.label);
      }
      break;
    }
    case "new_code": {
      const code = newCode();
      await query(`update station_licenses set code_hash = $2, code_hint = $3 where id = $1`, [id, hashCode(code), code.slice(-4)]);
      await logEvent(id, "new_code", `…${code.slice(-4)}`);
      return { row: await getLicense(id), code };
    }
    case "delete":
      await query(`delete from station_licenses where id = $1`, [id]);
      await query(`delete from license_events where license_id = $1`, [id]);
      await query(`delete from license_devices where license_id = $1`, [id]);
      return { row: null };
  }
  return { row: await getLicense(id) };
}

// ── Device side ───────────────────────────────────────────────────────────────
export type DeviceResult =
  | { ok: true; token: string; pub: JWK; row: LicenseRow; sync: DeviceSync | null }
  | { ok: false; error: "not_found" | "other_device" | "stopped" | "expired" | "no_modules"; row?: LicenseRow };

async function issue(row: LicenseRow, device: string): Promise<DeviceResult> {
  const token = await signLicense({ lid: row.id, lab: row.lab_name, dev: device, mods: row.modules, until: row.expires_at! });
  return { ok: true, token, pub: await publicKey(), row, sync: await deviceSync(row.id) };
}

/** A lab enters its code on a device: bind on first use (starting the period), refuse other devices. */
/** A version string as the app sends it ("2026.09.26-2343"); anything else is ignored. */
export const cleanVersion = (v: unknown) => (typeof v === "string" && /^[\w.-]{1,40}$/.test(v) ? v : "");

export async function activate(code: string, device: string, label: string, version = ""): Promise<DeviceResult> {
  await ensureTables();
  const r = await queryOne<{ id: string }>(`select id from station_licenses where code_hash = $1`, [hashCode(code)]);
  const row = r ? await getLicense(r.id) : null;
  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "stopped") return { ok: false, error: "stopped", row };
  const now = Date.now();
  if (row.device_id && row.device_id !== device) {
    // Another device of the same lab: allowed while the code has room for it (owner's setting).
    if (row.expires_at != null && row.expires_at <= now) return { ok: false, error: "expired", row };
    const known = await deviceAllowed(row, device);
    if (known === "extra") {
      await query(`update license_devices set last_seen_at = $3, app_version = $4 where license_id = $1 and device_id = $2`, [row.id, device, now, cleanVersion(version)]);
      return issue(row, device);
    }
    if ((await getPrefs()).multiDevice && 1 + row.devices.length < row.max_devices) {
      await query(`insert into license_devices (license_id, device_id, label, activated_at, last_seen_at, app_version) values ($1, $2, $3, $4, $4, $5)
        on conflict (license_id, device_id) do nothing`, [row.id, device, label.slice(0, 160), now, cleanVersion(version)]);
      await logEvent(row.id, "device_added", label.slice(0, 80));
      return issue((await getLicense(row.id))!, device);
    }
    return { ok: false, error: "other_device", row };
  }
  if (row.expires_at != null && row.expires_at <= now) return { ok: false, error: "expired", row };
  const expires = row.expires_at ?? now + row.duration_days * DAY;
  if (!row.device_id) await logEvent(row.id, row.activated_at ? "moved" : "activated", label.slice(0, 80));
  await query(
    `update station_licenses set device_id = $2, device_label = $3, activated_at = coalesce(activated_at, $4), expires_at = $5, last_seen_at = $4,
       app_version = $6 where id = $1`,
    [row.id, device, label.slice(0, 160), now, expires, cleanVersion(version)],
  );
  return issue((await getLicense(row.id))!, device);
}

/** Periodic check from an activated device: the current state, re-signed. */
export async function check(lid: string, device: string, version = ""): Promise<DeviceResult> {
  const row = await getLicense(lid);
  if (!row) return { ok: false, error: "not_found" };
  const which = await deviceAllowed(row, device);
  if (!which) return { ok: false, error: "other_device", row };
  const v = cleanVersion(version);
  if (which === "extra") {
    await query(`update license_devices set last_seen_at = $3${v ? ", app_version = $4" : ""} where license_id = $1 and device_id = $2`, v ? [lid, device, Date.now(), v] : [lid, device, Date.now()]);
  } else if (v) await query(`update station_licenses set last_seen_at = $2, app_version = $3 where id = $1`, [lid, Date.now(), v]);
  else await query(`update station_licenses set last_seen_at = $2 where id = $1`, [lid, Date.now()]);
  if (row.status === "stopped") return { ok: false, error: "stopped", row };
  if (row.expires_at != null && row.expires_at <= Date.now()) return { ok: false, error: "expired", row };
  return issue(row, device);
}

// ── The lab's own database («قاعدة بيانات المختبر») ──────────────────────────────
// Kept sealed with AUTH_SECRET (bound to the code's id), so a copy of the codes database alone
// reveals no lab's connection details. A short summary (kind, host) is kept beside it for the list.
const syncAad = (id: string) => `lab-sync:${id}`;
export type SyncSetError = "no_secret" | "bad_config" | "not_found";
/** Validate what the owner or the lab typed; returns a clean config or null. */
export function cleanSyncConfig(v: unknown): SyncConfig | null {
  const c = v as Partial<Record<string, unknown>> | null;
  if (!c || typeof c !== "object") return null;
  if (c.kind === "postgres") {
    const conn = String(c.conn ?? "").trim();
    return isPostgresUrl(conn) && conn.length <= 1000 ? { kind: "postgres", conn } : null;
  }
  if (c.kind === "supabase") {
    const url = String(c.url ?? "").trim().replace(/\/+$/, "");
    const anonKey = String(c.anonKey ?? "").trim(), email = String(c.email ?? "").trim(), password = String(c.password ?? "");
    if (!isSupabaseUrl(url) || !anonKey || anonKey.length > 2000 || !/^\S+@\S+$/.test(email) || !password || password.length > 200) return null;
    return { kind: "supabase", url, anonKey, email, password };
  }
  return null;
}
export async function getSyncConfig(id: string): Promise<{ cfg: SyncConfig; by: "owner" | "device" } | null> {
  await ensureTables();
  const r = await queryOne<{ sync_config: string }>(`select sync_config from station_licenses where id = $1`, [id]);
  const secret = sealSecret();
  if (!r?.sync_config || !secret) return null;
  try {
    const t = unsealText(JSON.parse(r.sync_config) as Sealed, secret, syncAad(id));
    return t ? (JSON.parse(t) as { cfg: SyncConfig; by: "owner" | "device" }) : null;
  } catch { return null; }
}
/** Link a code to a database (or unlink with null). */
export async function setSyncConfig(id: string, cfg: SyncConfig | null, by: "owner" | "device"): Promise<SyncSetError | null> {
  await ensureTables();
  if (!(await getLicense(id))) return "not_found";
  if (!cfg) {
    await query(`update station_licenses set sync_config = '', sync_info = '', sync_last_at = null, sync_pending = 0, sync_error = '', sync_reported_at = null where id = $1`, [id]);
    await logEvent(id, "sync", "—");
    return null;
  }
  const secret = sealSecret();
  if (!secret) return "no_secret";
  const host = cfg.kind === "postgres" ? connHost(cfg.conn) : (() => { try { return new URL(cfg.url).host; } catch { return ""; } })();
  const info: SyncInfo = { kind: cfg.kind, host, by, at: Date.now() };
  await query(`update station_licenses set sync_config = $2, sync_info = $3 where id = $1`,
    [id, JSON.stringify(sealText(JSON.stringify({ cfg, by }), secret, syncAad(id))), JSON.stringify(info)]);
  await logEvent(id, "sync", `${cfg.kind === "postgres" ? "PostgreSQL" : "Supabase"} — ${host}${by === "device" ? " (من الجهاز)" : ""}`);
  return null;
}
/** What the device receives: Supabase details (it connects itself), or only the host for PostgreSQL. */
async function deviceSync(id: string): Promise<DeviceSync | null> {
  const s = await getSyncConfig(id).catch(() => null);
  if (!s) return null;
  return s.cfg.kind === "postgres" ? { kind: "postgres", host: connHost(s.cfg.conn) } : s.cfg;
}
/** The device's own report about its sync (only the device bound to the code may report). */
export async function reportSyncStatus(lid: string, device: string, s: { last: number | null; pending: number; error: string }): Promise<boolean> {
  const row = await getLicense(lid);
  if (!row || !(await deviceAllowed(row, device))) return false;
  await query(`update station_licenses set sync_last_at = coalesce($2, sync_last_at), sync_pending = $3, sync_error = $4, sync_reported_at = $5 where id = $1`,
    [lid, s.last, s.pending, s.error, Date.now()]);
  return true;
}
// ── The full admin panel's own database («قاعدة لوحة الإدارة») ──────────────────────
// A PostgreSQL connection string kept sealed like the sync link; requests from the lab's admin
// panel are routed to it (src/lib/db/lab.ts). Set by the owner here, or by the lab's admin.
const adminDbAad = (id: string) => `lab-admin-db:${id}`;
export async function getAdminDb(id: string): Promise<{ conn: string; by: "owner" | "lab" } | null> {
  await ensureTables();
  const r = await queryOne<{ admin_db: string }>(`select admin_db from station_licenses where id = $1`, [id]);
  const secret = sealSecret();
  if (!r?.admin_db || !secret) return null;
  try {
    const t = unsealText(JSON.parse(r.admin_db) as Sealed, secret, adminDbAad(id));
    return t ? (JSON.parse(t) as { conn: string; by: "owner" | "lab" }) : null;
  } catch { return null; }
}
/** Give a code's admin panel its own database (or back to the site's with null). */
export async function setAdminDb(id: string, conn: string | null, by: "owner" | "lab"): Promise<SyncSetError | null> {
  await ensureTables();
  if (!(await getLicense(id))) return "not_found";
  if (!conn) {
    await query(`update station_licenses set admin_db = '', admin_db_info = '', admin_db_check_at = null, admin_db_ok = null, admin_db_error = '' where id = $1`, [id]);
    await logEvent(id, "admin_db", "—");
    return null;
  }
  conn = conn.trim();
  if (!isPostgresUrl(conn) || conn.length > 1000) return "bad_config";
  const secret = sealSecret();
  if (!secret) return "no_secret";
  const info: AdminDbInfo = { host: connHost(conn), by, at: Date.now(), provider: providerOf(conn) };
  // Saved only after it was opened, so it starts as a successful check.
  await query(`update station_licenses set admin_db = $2, admin_db_info = $3, admin_db_check_at = ${Date.now()}, admin_db_ok = true, admin_db_error = '' where id = $1`,
    [id, JSON.stringify(sealText(JSON.stringify({ conn, by }), secret, adminDbAad(id))), JSON.stringify(info)]);
  await logEvent(id, "admin_db", `${info.host}${by === "lab" ? " (من المختبر)" : ""}`);
  return null;
}

/** Where a code's admin panel works (see lib/db/lab.ts): its own database, or — unless the owner
 *  requires one for paid codes — its own section of the site's. */
export async function adminDbRoute(id: string): Promise<{ conn: string | null; trial: boolean; requireOwn: boolean }> {
  const [own, row, prefs] = await Promise.all([getAdminDb(id), getLicense(id), getPrefs()]);
  return { conn: own?.conn ?? null, trial: !!row?.is_trial, requireOwn: prefs.adminNeedsOwnDb };
}

/** The last check of a code's admin-panel database (the owner's «فحص», or the panel in use). */
export async function recordAdminDbCheck(id: string, ok: boolean, error: string) {
  await ensureTables();
  await query(`update station_licenses set admin_db_check_at = $2, admin_db_ok = $3, admin_db_error = $4 where id = $1 and admin_db <> ''`,
    [id, Date.now(), ok, ok ? "" : error.slice(0, 40)]);
}

/** A device asking for its lab's database: the code must be bound to it, running and in date. */
export async function deviceLicense(lid: string, device: string): Promise<{ ok: true; row: LicenseRow } | { ok: false; error: string }> {
  const row = await getLicense(lid);
  if (!row) return { ok: false, error: "not_found" };
  if (!(await deviceAllowed(row, device))) return { ok: false, error: "other_device" };
  if (row.status === "stopped") return { ok: false, error: "stopped" };
  if (row.expires_at != null && row.expires_at <= Date.now()) return { ok: false, error: "expired" };
  return { ok: true, row };
}

/** Owner's storage check: where the codes live, whether the database answers, and a write / read-back test. */
export async function storageStatus(write = false): Promise<{ source: string; ok: boolean; codes?: number; roundTripMs?: number; error?: string }> {
  const { licenseStorage } = await import("./env");
  const source = licenseStorage();
  try {
    await ensureTables();
    const n = Number((await queryOne<{ n: string | number }>(`select count(*) as n from station_licenses`))?.n ?? 0);
    if (!write) return { source, ok: true, codes: n };
    const t0 = Date.now(), stamp = String(t0);
    await setConfig("selftest", stamp);
    const back = await getConfig("selftest");
    await query(`delete from license_config where key = 'selftest'`);
    return back === stamp ? { source, ok: true, codes: n, roundTripMs: Date.now() - t0 } : { source, ok: false, codes: n, error: "readback" };
  } catch (e) {
    return { source, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "error" };
  }
}

// ── Attempt limits (kept in the database so they hold across server instances) ─────
type AttemptKind = "activate" | "owner" | "signup";
const ATTEMPT_WINDOW = 10 * 60_000;
const attemptKey = (kind: AttemptKind, ip: string) => `${kind}:${ip}`;
/** Too many wrong tries from this address in the last 10 minutes? */
export async function attemptsBlocked(kind: AttemptKind, ip: string, max: number): Promise<boolean> {
  try {
    await ensureTables();
    const r = await queryOne<{ n: string | number }>(`select count(*) as n from license_attempts where k = $1 and at > $2`, [attemptKey(kind, ip), Date.now() - ATTEMPT_WINDOW]);
    return Number(r?.n ?? 0) >= max;
  } catch { return false; } // never lock anyone out because the counter is unreachable
}
export async function noteAttempt(kind: AttemptKind, ip: string) {
  try {
    await ensureTables();
    await query(`insert into license_attempts (id, k, at) values ($1, $2, $3)`, [randomUUID(), attemptKey(kind, ip), Date.now()]);
    await query(`delete from license_attempts where at < $1`, [Date.now() - DAY]);
  } catch { /* ignore */ }
}
export async function clearAttempts(kind: AttemptKind, ip: string) {
  try { await query(`delete from license_attempts where k = $1`, [attemptKey(kind, ip)]); } catch { /* ignore */ }
}

// ── Error log («سجل الأخطاء», only while the owner has it on) ─────────────────────────
export interface ErrorEntry { id: string; at: number; license_id: string | null; lab: string; kind: string; path: string; message: string; digest: string; agent: string }
const ERROR_KEEP = 2000;
/** Keep an error from the site or a station (ignored while «سجل الأخطاء» is off). Never throws. */
export async function recordError(e: { lid?: string | null; kind: "server" | "client"; path?: string; message?: string; digest?: string; agent?: string }) {
  try {
    if (!(await getPrefs()).errorLog) return;
    await query(`insert into license_errors (id, at, license_id, kind, path, message, digest, agent) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), Date.now(), e.lid || null, e.kind, String(e.path ?? "").slice(0, 200), String(e.message ?? "").slice(0, 500), String(e.digest ?? "").slice(0, 40), String(e.agent ?? "").slice(0, 120)]);
    await query(`delete from license_errors where id in (select id from license_errors order by at desc offset ${ERROR_KEEP})`);
  } catch { /* the log never breaks anything */ }
}
export async function listErrors(limit = 300): Promise<ErrorEntry[]> {
  await ensureTables();
  const rows = await query<Omit<ErrorEntry, "lab" | "at"> & { at: string | number; lab: string | null }>(
    `select e.*, l.lab_name as lab from license_errors e left join station_licenses l on l.id = e.license_id order by e.at desc limit ${Math.max(1, Math.min(1000, limit))}`);
  return rows.map((r) => ({ ...r, at: Number(r.at), lab: r.lab ?? "" }));
}
export async function clearErrors() { await ensureTables(); await query(`delete from license_errors`); }

// ── Owner sign-in log («سجل الدخول») ────────────────────────────────────────────
export interface OwnerSignIn { at: number; ok: boolean; ip: string; agent: string }
export async function logOwnerSignIn(ok: boolean, ip: string, agent: string) {
  try {
    await ensureTables();
    await query(`insert into license_owner_log (id, at, ok, ip, agent) values ($1, $2, $3, $4, $5)`, [randomUUID(), Date.now(), ok, ip.slice(0, 64), agent.slice(0, 80)]);
    await query(`delete from license_owner_log where at < $1`, [Date.now() - 180 * DAY]);
  } catch { /* the log never blocks signing in */ }
}
export async function ownerSignIns(limit = 30): Promise<OwnerSignIn[]> {
  try {
    await ensureTables();
    const rows = await query<{ at: string | number; ok: boolean | string; ip: string; agent: string }>(
      `select at, ok, ip, agent from license_owner_log order by at desc limit $1`, [limit]);
    return rows.map((r) => ({ at: Number(r.at), ok: bool(r.ok), ip: r.ip, agent: r.agent }));
  } catch { return []; }
}

// ── Backup of the codes («نسخة احتياطية للرموز») ───────────────────────────────
// Codes (as hashes — the codes themselves are never stored), history and the contact line.
// The signing key is left out on purpose: after a restore the server makes a new one and every
// device picks it up at its next online check.
export interface CodesBackup {
  app: "lab-codes"; version: 1; exported_at: string;
  licenses: Record<string, unknown>[]; events: Record<string, unknown>[]; contact: string;
  /** Extra devices of the codes (added later; older files have none). */
  devices?: Record<string, unknown>[];
  /** The owner's settings (added later; older files have none). */
  prefs?: OwnerPrefs;
}
export async function exportCodes(): Promise<CodesBackup> {
  await ensureTables();
  const licenses = await query<Record<string, unknown>>(`select * from station_licenses order by created_at`);
  const events = await query<Record<string, unknown>>(`select * from license_events order by at`);
  const devices = await query<Record<string, unknown>>(`select * from license_devices order by activated_at`);
  return { app: "lab-codes", version: 1, exported_at: new Date().toISOString(), licenses, events, devices, contact: (await getConfig("contact")) ?? "", prefs: await getPrefs() };
}
const LIC_COLS = ["id", "code_hash", "code_hint", "lab_name", "note", "duration_days", "modules", "status", "device_id", "device_label",
  "activated_at", "expires_at", "last_seen_at", "created_at", "price", "paid", "paid_at", "message", "device_name", "is_trial", "app_version",
  "sync_config", "sync_info", "sync_last_at", "sync_pending", "sync_error", "sync_reported_at", "admin_db", "admin_db_info",
  "admin_db_check_at", "admin_db_ok", "admin_db_error", "max_devices", "source"] as const;
/** Merge a backup in: codes are added or updated by id (nothing is deleted); history is added once. */
export async function importCodes(data: unknown): Promise<{ licenses: number; events: number }> {
  const b = data as Partial<CodesBackup>;
  if (!b || b.app !== "lab-codes" || !Array.isArray(b.licenses) || !Array.isArray(b.events)) throw new Error("invalid");
  await ensureTables();
  let nl = 0, ne = 0;
  for (const r of b.licenses) {
    if (typeof r.id !== "string" || typeof r.code_hash !== "string" || typeof r.lab_name !== "string") continue;
    const vals = LIC_COLS.map((c) => {
      const v = r[c];
      if (c === "paid" || c === "is_trial") return v === true || v === "t" || v === "true";
      if (c === "modules") return typeof v === "string" ? v : JSON.stringify(cleanModules(v));
      return v ?? (["note", "code_hint", "price", "message", "device_name", "app_version", "sync_config", "sync_info", "sync_error", "admin_db", "admin_db_info", "admin_db_error", "source"].includes(c) ? "" : c === "sync_pending" ? 0 : c === "max_devices" ? 1 : c === "status" ? "active" : null);
    });
    await query(
      `insert into station_licenses (${LIC_COLS.join(", ")}) values (${LIC_COLS.map((_, i) => `$${i + 1}`).join(", ")})
       on conflict (id) do update set ${LIC_COLS.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ")}`,
      vals,
    );
    nl++;
  }
  for (const e of b.events) {
    if (typeof e.id !== "string" || typeof e.license_id !== "string") continue;
    await query(`insert into license_events (id, license_id, at, kind, detail) values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
      [e.id, e.license_id, Number(e.at), String(e.kind ?? ""), String(e.detail ?? "")]);
    ne++;
  }
  for (const d of Array.isArray(b.devices) ? b.devices : []) {
    if (typeof d.license_id !== "string" || typeof d.device_id !== "string") continue;
    await query(`insert into license_devices (license_id, device_id, label, activated_at, last_seen_at, app_version) values ($1, $2, $3, $4, $5, $6)
      on conflict (license_id, device_id) do nothing`,
      [d.license_id, d.device_id, String(d.label ?? ""), Number(d.activated_at) || Date.now(), d.last_seen_at == null ? null : Number(d.last_seen_at), String(d.app_version ?? "")]);
  }
  if (typeof b.contact === "string" && b.contact.trim()) await setConfig("contact", b.contact.trim().slice(0, 300));
  if (b.prefs && typeof b.prefs === "object") await setPrefs(b.prefs);
  return { licenses: nl, events: ne };
}
