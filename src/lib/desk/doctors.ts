import "server-only";
import { query, queryOne } from "@/lib/db";
import { labTarget } from "@/lib/db/lab";
import { licensingEnabled } from "@/lib/license/server";
import { doctorsOn, publish, revoke } from "@/lib/doctors/server";
import { doctorKeys, sealSnapshot, WINDOW_DAYS, type DoctorSnapshot, type DoctorVisit, type DoctorWindow } from "@/lib/doctors/code";
import { getLabIdentity, labName } from "@/lib/lab-identity";
import { ensureOps } from "./schema";
import { formPlain } from "@/lib/station/formPlain";

/**
 * «نافذة الأطباء» fed from the admin panel: each referring doctor's code is kept in the lab's
 * database, and the server seals the doctor's verified results with it and leaves them where the
 * doctors' window fetches them (the same as the lab station's «رموز الأطباء», without a computer
 * having to stay on).
 */
export interface CodeRow { id: string; referrer_id: string; code: string; tag: string; win: DoctorWindow; hide_phone: boolean }

/** Whose copies these are on the server: the lab's code (or the installation itself). */
export async function doctorScope(): Promise<string> {
  if (!licensingEnabled()) return "local";
  return (await labTarget())?.lid ?? "site";
}

async function snapshot(row: CodeRow): Promise<DoctorSnapshot> {
  const identity = await getLabIdentity();
  const doctor = (await queryOne<{ name: string }>(`select name from referrers where id = $1`, [row.referrer_id]))?.name ?? "";
  const days = WINDOW_DAYS[row.win] ?? 31;
  const orders = await query<any>(
    `select o.id, o.accession_no, o.created_at, o.delivered_at, p.full_name, p.gender, p.age_years, p.phone
       from test_orders o join patients p on p.id = o.patient_id
      where o.referrer_id = $1 and o.status in ('completed', 'delivered') and o.created_at >= now() - ($2 || ' days')::interval
      order by o.created_at desc limit 400`,
    [row.referrer_id, String(days)]
  );
  const ids = orders.map((o) => o.id);
  const results = ids.length ? await query<any>(
    `select r.order_id, t.name_ar, t.unit, t.normal_low, t.normal_high, t.normal_text, r.value_numeric, r.value_text, r.flag, r.hl
       from test_results r join test_catalog t on t.id = r.test_id where r.order_id = any($1) order by t.category nulls last, t.name_ar`,
    [ids]
  ) : [];
  const visits: DoctorVisit[] = orders.map((o) => ({
    id: o.id, at: new Date(o.created_at).getTime(), ...(o.accession_no ? { acc: o.accession_no } : {}),
    patient: {
      name: o.full_name, gender: o.gender ?? "", ...(o.age_years != null ? { age: String(o.age_years) } : {}),
      ...(!row.hide_phone && o.phone ? { phone: o.phone } : {}),
    },
    results: results.filter((r) => r.order_id === o.id).map((r) => {
      const range = r.normal_low != null || r.normal_high != null ? `${r.normal_low ?? ""} – ${r.normal_high ?? ""}`.trim() : r.normal_text || undefined;
      return {
        name: r.name_ar, value: r.value_text != null ? formPlain(r.value_text) : String(Number(r.value_numeric)), ...(r.unit ? { unit: r.unit } : {}),
        ...(range ? { range } : {}), ...(r.flag ? { flag: r.flag } : {}), ...(r.hl ? { hl: true } : {}),
      };
    }),
    ...(o.delivered_at ? { delivered: new Date(o.delivered_at).getTime() } : {}),
  }));
  return {
    v: 1, lab: { name: labName(identity), ...(identity.subtitle ? { sub: identity.subtitle } : {}), ...(identity.footer ? { footer: identity.footer } : {}) },
    doctor, window: row.win, at: Date.now(), visits,
  };
}

/** Seal and upload one code's copy; the result is written beside the code. */
export async function publishCode(row: CodeRow): Promise<{ ok: boolean; error?: string }> {
  let r: { ok: boolean; error?: string };
  try {
    if (!(await doctorsOn())) r = { ok: false, error: "off" };
    else r = await publish(await doctorScope(), row.tag, sealSnapshot(doctorKeys(row.code).key, await snapshot(row)));
  } catch (e) {
    r = { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "error" };
  }
  await query(`update doctor_codes set last_at = case when $2 then now() else last_at end, last_error = $3 where id = $1`, [row.id, r.ok, r.ok ? null : r.error ?? "error"]);
  return r;
}

/** After a referring doctor's results are verified or delivered: his copies are renewed. */
export async function publishForReferrer(referrerId: string | null | undefined): Promise<void> {
  if (!referrerId) return;
  try {
    await ensureOps();
    const rows = await query<CodeRow>(`select id, referrer_id, code, tag, win, hide_phone from doctor_codes where referrer_id = $1`, [referrerId]);
    for (const row of rows) await publishCode(row);
  } catch {
    // the doctors' copy never stops the lab's work
  }
}

export async function revokeCode(row: CodeRow): Promise<void> {
  await revoke(await doctorScope(), row.tag).catch(() => undefined);
}
