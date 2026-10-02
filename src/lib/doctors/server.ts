import "server-only";
import { licensingEnabled, deviceFromToken, getPrefs, licenseQuery as query } from "@/lib/license/server";
import { okTag } from "./code";

/**
 * «نافذة الأطباء» on the server: one sealed copy of a doctor's results per doctor code, left by
 * the lab's computer and replaced at each upload. Kept under a name made from the code; the code
 * itself never reaches the server, so the results cannot be read here. A copy not renewed for
 * 90 days is removed.
 */
const DAY = 86_400_000;
export const MAX_BOX = 4_000_000;

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  // See supabase/migrations/0029_doctor_shares.sql.
  ready ??= query(`create table if not exists doctor_shares (tag text primary key, scope text not null, at bigint not null, box text not null)`)
    .then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

let cached: { at: number; on: boolean } | null = null;
export function forgetDoctorsInfo() { cached = null; }
/** Whether the service is on (the owner's switch; always on a lab's own installation). */
export async function doctorsOn(): Promise<boolean> {
  if (!licensingEnabled()) return true;
  if (cached && Date.now() - cached.at < 15_000) return cached.on;
  const on = (await getPrefs()).doctorsOn;
  cached = { at: Date.now(), on };
  return on;
}

/** The lab's computer (a valid code of the lab on the provider's site; any computer on its own installation). */
export async function labScope(b: Record<string, unknown>): Promise<{ ok: true; scope: string } | { ok: false; error: string; status: number }> {
  if (!licensingEnabled()) return { ok: true, scope: "local" };
  const who = await deviceFromToken(b.token, b.device);
  return who.ok ? { ok: true, scope: who.lid } : { ok: false, error: who.error, status: 403 };
}

export async function publish(scope: string, tag: unknown, box: unknown) {
  if (!okTag(tag) || typeof box !== "string") return { ok: false, error: "bad_request" };
  if (box.length > MAX_BOX) return { ok: false, error: "too_big" };
  await ensureTable();
  const cur = await query<{ scope: string }>(`select scope from doctor_shares where tag = $1`, [tag]);
  if (cur[0] && cur[0].scope !== scope) return { ok: false, error: "taken" };
  const at = Date.now();
  await query(`insert into doctor_shares (tag, scope, at, box) values ($1, $2, $3, $4)
    on conflict (tag) do update set at = excluded.at, box = excluded.box`, [tag, scope, at, box]);
  if (Math.random() < 0.05) await query(`delete from doctor_shares where at < $1`, [at - 90 * DAY]);
  return { ok: true, at };
}
/** The lab stops a code: its copy is removed at once. */
export async function revoke(scope: string, tag: unknown) {
  if (!okTag(tag)) return { ok: false, error: "bad_request" };
  await ensureTable();
  await query(`delete from doctor_shares where tag = $1 and scope = $2`, [tag, scope]);
  return { ok: true };
}
/** The doctor's window: the sealed copy for a code's name (nothing else is asked or given). */
export async function fetchShare(tag: unknown) {
  if (!okTag(tag)) return { ok: false, error: "bad_request" };
  await ensureTable();
  const r = await query<{ at: string; box: string }>(`select at, box from doctor_shares where tag = $1`, [tag]);
  return r[0] ? { ok: true, at: Number(r[0].at), box: r[0].box } : { ok: false, error: "not_found" };
}
