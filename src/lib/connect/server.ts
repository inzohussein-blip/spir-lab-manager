import "server-only";
import { createHash } from "node:crypto";
import { licensingEnabled, deviceFromToken, getPrefs, licenseQuery as query, licenseConfig } from "@/lib/license/server";
import { roomKeys } from "./crypto";

/**
 * «محطة التواصل» on the server. It only ever keeps sealed messages it cannot open:
 * • the lab's internal chat — under a name made from «رمز المحادثة» (never sent here), on the
 *   lab's own installation, or on the provider's site when the owner allows it («connectRelay»);
 * • the mailbox between labs — sealed for the receiving lab's key (also «connectRelay»);
 * • and «المحادثة العامة» (readable by design): a name and a text per message, nothing else is
 *   shown to the labs; the owner can delete a message or block a lab.
 */
const DAY = 86_400_000;
const KEEP_DAYS = 30;
const ONLINE_MS = 45_000;
export const LIMITS = { box: 24_000, mail: 64_000, text: 500, name: 40 };

let ready: Promise<void> | null = null;
export function ensureConnectTables(): Promise<void> {
  ready ??= (async () => {
    // See supabase/migrations/0028_connect.sql.
    await query(`create table if not exists connect_room (id bigserial primary key, scope text not null, tag text not null, at bigint not null, box text not null)`);
    await query(`create index if not exists connect_room_tag on connect_room (scope, tag, id)`);
    await query(`create table if not exists connect_presence (scope text not null, tag text not null, dev text not null, at bigint not null, box text not null, primary key (scope, tag, dev))`);
    await query(`create table if not exists connect_addr (addr text primary key, lid text not null, at bigint not null)`);
    await query(`create table if not exists connect_mailbox (id bigserial primary key, to_addr text not null, from_pub text not null, at bigint not null, box text not null)`);
    await query(`create index if not exists connect_mailbox_to on connect_mailbox (to_addr, id)`);
    await query(`create table if not exists connect_public (id bigserial primary key, at bigint not null, lid text not null, name text not null, lab boolean not null default false, text text not null)`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// ── Who is asking ────────────────────────────────────────────────────────────
export type Who = { ok: true; scope: string; lid: string; lab: string } | { ok: false; error: string; status: number };
/** A device of a lab whose code includes «محطة التواصل» (on the provider's site), or any computer
 *  of the lab's own installation (no lab codes there: the server is the lab's). */
export async function whoIs(b: Record<string, unknown>, needCode = false): Promise<Who> {
  if (!licensingEnabled()) return needCode ? { ok: false, error: "site_only", status: 400 } : { ok: true, scope: "local", lid: "", lab: "" };
  const who = await deviceFromToken(b.token, b.device);
  if (!who.ok) return { ok: false, error: who.error, status: 403 };
  if (!who.row.modules.includes("connect")) return { ok: false, error: "module_off", status: 403 };
  return { ok: true, scope: who.lid, lid: who.lid, lab: who.row.lab_name };
}

/** What this server offers the station. */
export async function connectInfo() {
  if (!licensingEnabled()) return { licensing: false, room: true, relay: false, public: false };
  const p = await getPrefs();
  return { licensing: true, room: p.connectRelay, relay: p.connectRelay, public: p.connectPublic };
}

// ── The lab's internal chat ──────────────────────────────────────────────────
let syncTag: string | null = null;
/** The room name «رمز المحادثة» would have if it were the sync's key («خادم الشبكة المحلية»). */
function syncKeyTag(): string {
  const k = (process.env.LAN_HUB_KEY ?? "").trim();
  if (!k) return "";
  syncTag ??= roomKeys(k).tag;
  return syncTag;
}
const okTag = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{40}$/.test(t);
const devOf = (d: unknown) => createHash("sha256").update(`connect-dev:${String(d ?? "")}`).digest("hex").slice(0, 24);

export async function roomSend(scope: string, tag: unknown, box: unknown): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!okTag(tag) || typeof box !== "string" || box.length > LIMITS.box) return { ok: false, error: "bad_request" };
  if (tag === syncKeyTag()) return { ok: false, error: "same_as_sync" };
  await ensureConnectTables();
  const at = Date.now();
  const r = await query<{ id: string }>(`insert into connect_room (scope, tag, at, box) values ($1, $2, $3, $4) returning id`, [scope, tag, at, box]);
  if (Math.random() < 0.05) await query(`delete from connect_room where at < $1`, [at - KEEP_DAYS * DAY]);
  return { ok: true, id: Number(r[0].id) };
}
export async function roomPoll(scope: string, tag: unknown, since: unknown, me: { dev?: unknown; box?: unknown }) {
  if (!okTag(tag)) return { ok: false as const, error: "bad_request" };
  if (tag === syncKeyTag()) return { ok: false as const, error: "same_as_sync" };
  await ensureConnectTables();
  const now = Date.now();
  // This computer is here (its name sealed with the room's key).
  if (me.dev && typeof me.box === "string" && me.box.length < 2000) {
    await query(`insert into connect_presence (scope, tag, dev, at, box) values ($1, $2, $3, $4, $5)
      on conflict (scope, tag, dev) do update set at = excluded.at, box = excluded.box`, [scope, tag, devOf(me.dev), now, me.box]);
  }
  const rows = await query<{ id: string; at: string; box: string }>(
    `select id, at, box from connect_room where scope = $1 and tag = $2 and id > $3 and at > $4 order by id limit 200`,
    [scope, tag, Math.max(0, Number(since) || 0), now - KEEP_DAYS * DAY]);
  const online = await query<{ dev: string; at: string; box: string }>(
    `select dev, at, box from connect_presence where scope = $1 and tag = $2 and at > $3`, [scope, tag, now - ONLINE_MS]);
  return {
    ok: true as const,
    rows: rows.map((r) => ({ id: Number(r.id), at: Number(r.at), box: r.box })),
    online: online.map((o) => ({ me: o.dev === devOf(me.dev), at: Number(o.at), box: o.box })),
  };
}

// ── The mailbox between labs ─────────────────────────────────────────────────
const okAddr = (a: unknown): a is string => typeof a === "string" && /^[0-9a-f]{40}$/.test(a);
const addrOfPub = (pub: string) => createHash("sha256").update(`spir-connect-addr:${pub}`).digest("hex").slice(0, 40);
/** A lab's computer opens its mailbox: its address is bound to its code. */
export async function mailRegister(lid: string, pub: unknown) {
  if (typeof pub !== "string" || pub.length > 60) return { ok: false, error: "bad_request" };
  await ensureConnectTables();
  const addr = addrOfPub(pub);
  const cur = await query<{ lid: string }>(`select lid from connect_addr where addr = $1`, [addr]);
  if (cur[0] && cur[0].lid !== lid) return { ok: false, error: "taken" };
  await query(`insert into connect_addr (addr, lid, at) values ($1, $2, $3) on conflict (addr) do update set at = excluded.at`, [addr, lid, Date.now()]);
  return { ok: true, addr };
}
export async function mailSend(to: unknown, fromPub: unknown, box: unknown) {
  if (!okAddr(to) || typeof fromPub !== "string" || fromPub.length > 60 || typeof box !== "string" || box.length > LIMITS.mail) return { ok: false, error: "bad_request" };
  await ensureConnectTables();
  if (!(await query(`select 1 from connect_addr where addr = $1`, [to])).length) return { ok: false, error: "no_mailbox" };
  const n = await query<{ n: string }>(`select count(*) as n from connect_mailbox where to_addr = $1`, [to]);
  if (Number(n[0]?.n ?? 0) >= 500) return { ok: false, error: "full" };
  await query(`insert into connect_mailbox (to_addr, from_pub, at, box) values ($1, $2, $3, $4)`, [to, fromPub, Date.now(), box]);
  return { ok: true };
}
async function ownsAddr(lid: string, addr: unknown) {
  return okAddr(addr) && (await query<{ lid: string }>(`select lid from connect_addr where addr = $1`, [addr]))[0]?.lid === lid;
}
export async function mailFetch(lid: string, addr: unknown) {
  await ensureConnectTables();
  if (!(await ownsAddr(lid, addr))) return { ok: false, error: "not_yours" };
  const rows = await query<{ id: string; from_pub: string; at: string; box: string }>(
    `select id, from_pub, at, box from connect_mailbox where to_addr = $1 and at > $2 order by id limit 100`, [addr, Date.now() - KEEP_DAYS * DAY]);
  return { ok: true, rows: rows.map((r) => ({ id: Number(r.id), from: r.from_pub, at: Number(r.at), box: r.box })) };
}
/** Received: removed from the mailbox. */
export async function mailAck(lid: string, addr: unknown, ids: unknown) {
  if (!(await ownsAddr(lid, addr)) || !Array.isArray(ids)) return { ok: false, error: "not_yours" };
  const list = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  if (list.length) await query(`delete from connect_mailbox where to_addr = $1 and id = any($2::bigint[])`, [addr, list]);
  return { ok: true };
}

// ── «المحادثة العامة» ────────────────────────────────────────────────────────
export async function blockedLabs(): Promise<string[]> {
  try { const v = JSON.parse((await licenseConfig.get("connect_blocked")) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export async function setBlocked(lid: string, on: boolean) {
  const cur = new Set(await blockedLabs());
  if (on) cur.add(lid); else cur.delete(lid);
  await licenseConfig.set("connect_blocked", JSON.stringify([...cur]));
}
export async function publicSend(who: { lid: string; lab: string }, b: Record<string, unknown>) {
  const text = String(b.text ?? "").trim().slice(0, LIMITS.text);
  if (!text) return { ok: false, error: "empty" };
  if ((await blockedLabs()).includes(who.lid)) return { ok: false, error: "blocked" };
  // The lab's name comes from its code (never from the device); a chosen name is marked so.
  const asLab = b.as === "lab";
  const name = asLab ? who.lab.slice(0, LIMITS.name) : String(b.alias ?? "").trim().slice(0, LIMITS.name);
  if (!name) return { ok: false, error: "no_name" };
  await ensureConnectTables();
  const now = Date.now();
  const last = await query<{ at: string }>(`select at from connect_public where lid = $1 order by id desc limit 1`, [who.lid]);
  if (last[0] && now - Number(last[0].at) < 2000) return { ok: false, error: "too_fast" };
  const r = await query<{ id: string }>(`insert into connect_public (at, lid, name, lab, text) values ($1, $2, $3, $4, $5) returning id`, [now, who.lid, name, asLab, text]);
  if (Math.random() < 0.05) await query(`delete from connect_public where at < $1`, [now - KEEP_DAYS * DAY]);
  return { ok: true, id: Number(r[0].id), at: now, name, lab: asLab };
}
/** The latest messages after `since` — a name and a text each (and «mine» for the asking lab). */
export async function publicPoll(lid: string, since: unknown) {
  await ensureConnectTables();
  const s = Math.max(0, Number(since) || 0);
  const rows = await query<{ id: string; at: string; lid: string; name: string; lab: boolean | string; text: string }>(
    s ? `select id, at, lid, name, lab, text from connect_public where id > $1 order by id limit 200`
      : `select * from (select id, at, lid, name, lab, text from connect_public order by id desc limit 100) x order by id`,
    s ? [s] : []);
  return {
    ok: true,
    rows: rows.map((r) => ({ id: Number(r.id), at: Number(r.at), name: r.name, lab: r.lab === true || r.lab === "t" || r.lab === "true", text: r.text, mine: r.lid === lid })),
  };
}
/** For the owner: the messages with the lab behind each name. */
export async function publicForOwner() {
  await ensureConnectTables();
  const rows = await query<{ id: string; at: string; lid: string; name: string; lab: boolean | string; text: string; lab_name: string | null }>(
    `select p.id, p.at, p.lid, p.name, p.lab, p.text, l.lab_name from connect_public p left join station_licenses l on l.id = p.lid order by p.id desc limit 300`);
  const blocked = await blockedLabs();
  const names = blocked.length ? await query<{ id: string; lab_name: string }>(`select id, lab_name from station_licenses where id = any($1::text[])`, [blocked]) : [];
  return {
    messages: rows.map((r) => ({ id: Number(r.id), at: Number(r.at), lid: r.lid, name: r.name, lab: r.lab === true || r.lab === "t" || r.lab === "true", text: r.text, labName: r.lab_name ?? "" })),
    blocked: blocked.map((id) => ({ lid: id, labName: names.find((n) => n.id === id)?.lab_name ?? "" })),
  };
}
export async function publicDelete(id: unknown) {
  await ensureConnectTables();
  await query(`delete from connect_public where id = $1`, [Number(id) || 0]);
}
