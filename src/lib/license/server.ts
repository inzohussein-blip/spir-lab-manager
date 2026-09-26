import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair, importJWK, type JWK, type KeyLike } from "jose";
import { query, queryOne } from "@/lib/db";
import { cleanModules, type LicenseModule, type LicensePayload } from "./modules";

/**
 * Lab codes («منظومة الرموز»): one code per lab, bound to one device on first use, valid for a
 * number of days counted from that activation, with the stations (and the full admin panel)
 * it may open. The code itself is stored only as a hash.
 *
 * A device gets a license signed with an ES256 key kept in the database; the stations verify it
 * offline and refresh it from the server when online (extension, station changes, stop).
 * Switched on by setting LICENSE_ADMIN_PASSWORD (the owner's password for /licenses).
 */

export const licensingEnabled = () => !!(process.env.LICENSE_ADMIN_PASSWORD ?? "").trim();
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
}

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

export async function getContact(): Promise<string> {
  return ((await getConfig("contact").catch(() => null)) ?? (process.env.STATION_ACTIVATION_CONTACT ?? "")).trim();
}
export async function setContact(v: string) { await setConfig("contact", v.trim().slice(0, 300)); }

// ── Signing key (generated once, kept server-side in the database) ────────────
let keys: Promise<{ priv: KeyLike | Uint8Array; pub: JWK }> | null = null;
function signingKeys() {
  keys ??= (async () => {
    const saved = await getConfig("signing_key");
    if (saved) {
      const { priv, pub } = JSON.parse(saved) as { priv: JWK; pub: JWK };
      return { priv: await importJWK(priv, "ES256"), pub };
    }
    const kp = await generateKeyPair("ES256", { extractable: true });
    const priv = await exportJWK(kp.privateKey), pub = await exportJWK(kp.publicKey);
    await query(`insert into license_config (key, value) values ('signing_key', $1) on conflict (key) do nothing`, [JSON.stringify({ priv, pub })]);
    // Another instance may have won the race — always use what is stored.
    const stored = JSON.parse((await getConfig("signing_key"))!) as { priv: JWK; pub: JWK };
    return { priv: await importJWK(stored.priv, "ES256"), pub: stored.pub };
  })().catch((e) => { keys = null; throw e; });
  return keys;
}
export async function publicKey(): Promise<JWK> { return (await signingKeys()!).pub; }

async function signLicense(p: Omit<LicensePayload, "iat">): Promise<string> {
  const { priv } = await signingKeys()!;
  return new SignJWT({ ...p }).setProtectedHeader({ alg: "ES256" }).setIssuedAt().sign(priv);
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

type Raw = Omit<LicenseRow, "modules" | "activated_at" | "expires_at" | "last_seen_at" | "created_at"> & {
  modules: string; activated_at: string | number | null; expires_at: string | number | null; last_seen_at: string | number | null; created_at: string | number;
};
const num = (v: string | number | null) => (v == null ? null : Number(v));
function toRow(r: Raw): LicenseRow {
  let mods: unknown = [];
  try { mods = JSON.parse(r.modules); } catch { /* keep empty */ }
  return {
    ...r, duration_days: Number(r.duration_days), modules: cleanModules(mods),
    activated_at: num(r.activated_at), expires_at: num(r.expires_at), last_seen_at: num(r.last_seen_at), created_at: Number(r.created_at),
  };
}

export async function listLicenses(): Promise<LicenseRow[]> {
  await ensureTables();
  const rows = await query<Raw>(`select id, lab_name, note, code_hint, duration_days, modules, status, device_id, device_label,
    activated_at, expires_at, last_seen_at, created_at from station_licenses order by created_at desc`);
  return rows.map(toRow);
}
async function getLicense(id: string): Promise<LicenseRow | null> {
  await ensureTables();
  const r = await queryOne<Raw>(`select id, lab_name, note, code_hint, duration_days, modules, status, device_id, device_label,
    activated_at, expires_at, last_seen_at, created_at from station_licenses where id = $1`, [id]);
  return r ? toRow(r) : null;
}

export async function createLicense(v: { lab: string; days: number; modules: unknown; note?: string }): Promise<{ row: LicenseRow; code: string }> {
  await ensureTables();
  const code = newCode();
  const id = randomUUID();
  const days = Math.max(1, Math.min(3650, Math.round(v.days)));
  await query(
    `insert into station_licenses (id, code_hash, code_hint, lab_name, note, duration_days, modules, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, hashCode(code), code.slice(-4), v.lab.trim().slice(0, 120), (v.note ?? "").trim().slice(0, 300), days, JSON.stringify(cleanModules(v.modules)), Date.now()],
  );
  return { row: (await getLicense(id))!, code };
}

export type LicenseAction =
  | { action: "extend"; days: number }
  | { action: "stop" } | { action: "resume" }
  | { action: "reset_device" }
  | { action: "modules"; modules: unknown }
  | { action: "rename"; lab: string; note?: string }
  | { action: "new_code" }
  | { action: "delete" };

/** Owner actions from /licenses. Returns the new code for "new_code". */
export async function updateLicense(id: string, a: LicenseAction): Promise<{ row: LicenseRow | null; code?: string }> {
  const cur = await getLicense(id);
  if (!cur) return { row: null };
  switch (a.action) {
    case "extend": {
      const days = Math.max(1, Math.min(3650, Math.round(a.days)));
      if (cur.expires_at == null) await query(`update station_licenses set duration_days = duration_days + $2 where id = $1`, [id, days]);
      else await query(`update station_licenses set expires_at = $2 where id = $1`, [id, Math.max(cur.expires_at, Date.now()) + days * DAY]);
      break;
    }
    case "stop": await query(`update station_licenses set status = 'stopped' where id = $1`, [id]); break;
    case "resume": await query(`update station_licenses set status = 'active' where id = $1`, [id]); break;
    case "reset_device": await query(`update station_licenses set device_id = null, device_label = null where id = $1`, [id]); break;
    case "modules": await query(`update station_licenses set modules = $2 where id = $1`, [id, JSON.stringify(cleanModules(a.modules))]); break;
    case "rename": await query(`update station_licenses set lab_name = $2, note = $3 where id = $1`, [id, a.lab.trim().slice(0, 120) || cur.lab_name, (a.note ?? cur.note).trim().slice(0, 300)]); break;
    case "new_code": {
      const code = newCode();
      await query(`update station_licenses set code_hash = $2, code_hint = $3 where id = $1`, [id, hashCode(code), code.slice(-4)]);
      return { row: await getLicense(id), code };
    }
    case "delete": await query(`delete from station_licenses where id = $1`, [id]); return { row: null };
  }
  return { row: await getLicense(id) };
}

// ── Device side ───────────────────────────────────────────────────────────────
export type DeviceResult =
  | { ok: true; token: string; pub: JWK; row: LicenseRow }
  | { ok: false; error: "not_found" | "other_device" | "stopped" | "expired" | "no_modules"; row?: LicenseRow };

async function issue(row: LicenseRow, device: string): Promise<DeviceResult> {
  const token = await signLicense({ lid: row.id, lab: row.lab_name, dev: device, mods: row.modules, until: row.expires_at! });
  return { ok: true, token, pub: await publicKey(), row };
}

/** A lab enters its code on a device: bind on first use (starting the period), refuse other devices. */
export async function activate(code: string, device: string, label: string): Promise<DeviceResult> {
  await ensureTables();
  const r = await queryOne<{ id: string }>(`select id from station_licenses where code_hash = $1`, [hashCode(code)]);
  const row = r ? await getLicense(r.id) : null;
  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "stopped") return { ok: false, error: "stopped", row };
  if (row.device_id && row.device_id !== device) return { ok: false, error: "other_device", row };
  const now = Date.now();
  if (row.expires_at != null && row.expires_at <= now) return { ok: false, error: "expired", row };
  const expires = row.expires_at ?? now + row.duration_days * DAY;
  await query(
    `update station_licenses set device_id = $2, device_label = $3, activated_at = coalesce(activated_at, $4), expires_at = $5, last_seen_at = $4 where id = $1`,
    [row.id, device, label.slice(0, 160), now, expires],
  );
  return issue((await getLicense(row.id))!, device);
}

/** Periodic check from an activated device: the current state, re-signed. */
export async function check(lid: string, device: string): Promise<DeviceResult> {
  const row = await getLicense(lid);
  if (!row) return { ok: false, error: "not_found" };
  if (row.device_id !== device) return { ok: false, error: "other_device", row };
  await query(`update station_licenses set last_seen_at = $2 where id = $1`, [lid, Date.now()]);
  if (row.status === "stopped") return { ok: false, error: "stopped", row };
  if (row.expires_at != null && row.expires_at <= Date.now()) return { ok: false, error: "expired", row };
  return issue(row, device);
}
