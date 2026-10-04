"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";
import { ensureOps } from "@/lib/desk/schema";
import type { StationTest, StationVisit, NormalRange } from "@/lib/station/store";

/**
 * «استيراد من المحطات»: a lab station's backup file (its tests, patients and visits with results)
 * brought into the admin panel. Tests are matched by code or name (missing ones are added, no
 * price), patients by name and phone, doctors by name; each visit is imported once.
 */
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
async function admin() {
  const u = await getCurrentUser();
  return u?.role === "admin" ? u : null;
}
const lohi = (n: NormalRange): [number | null, number | null, string | null] =>
  n.kind === "numeric" ? [n.low, n.high, null] : n.kind === "sex" ? [n.male.low, n.male.high, null] : n.kind === "text" || n.kind === "qual" ? [null, null, n.text] : [null, null, null];

/** The station's tests → catalog ids (by the station's test id). */
export async function importStationTests(tests: StationTest[]): Promise<Res<{ map: Record<string, string>; added: number }>> {
  if (!(await admin())) return { ok: false, error: "للمدير فقط." };
  await ensureOps();
  const cat = await query<{ id: string; code: string | null; name_ar: string }>(`select id, code, name_ar from test_catalog`);
  const map: Record<string, string> = {};
  let added = 0;
  for (const t of (tests ?? []).slice(0, 2000)) {
    if (!t?.id || !t.name_ar?.trim()) continue;
    const hit = cat.find((c) => (t.code && c.code === t.code) || c.name_ar.trim() === t.name_ar.trim());
    if (hit) { map[t.id] = hit.id; continue; }
    const [lo, hi, text] = lohi(t.normal ?? { kind: "none" });
    let code = t.code?.trim().slice(0, 40) || null;
    if (code && cat.some((c) => c.code === code)) code = null;
    const row = await queryOne<{ id: string }>(
      `insert into test_catalog (code, name_ar, name_en, category, sample_type, unit, normal_low, normal_high, normal_text, normal, price)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0) returning id`,
      [code, t.name_ar.trim().slice(0, 200), t.name_en ?? null, t.category ?? null, t.sample_type ?? null, t.unit ?? null, lo, hi, text, JSON.stringify(t.normal ?? { kind: "none" })]
    );
    map[t.id] = row!.id;
    cat.push({ id: row!.id, code, name_ar: t.name_ar.trim() });
    added++;
  }
  revalidatePath("/tests");
  return { ok: true, map, added };
}

/** A batch of the station's visits (each once: «station_ref» remembers it). */
export async function importStationVisits(visits: StationVisit[], map: Record<string, string>): Promise<Res<{ imported: number; skipped: number }>> {
  const u = await admin();
  if (!u) return { ok: false, error: "للمدير فقط." };
  await ensureOps();
  let imported = 0, skipped = 0;
  const doctors = new Map<string, string>();
  for (const v of (visits ?? []).slice(0, 300)) {
    const name = v?.patient?.name?.trim();
    const results = (v?.results ?? []).filter((r) => map[r.testId]);
    if (!v?.id || !name || !results.length) { skipped++; continue; }
    const ref = `station:${String(v.id).slice(0, 80)}`;
    if (await queryOne(`select 1 from test_orders where station_ref = $1`, [ref])) { skipped++; continue; }
    const phone = v.patient.phone?.trim() || null;
    let pid = (await queryOne<{ id: string }>(
      `select id from patients where full_name = $1 and coalesce(phone, '') = coalesce($2, '') limit 1`, [name, phone]
    ))?.id;
    if (!pid) {
      const age = /^\d{1,3}$/.test(String(v.patient.age ?? "").trim()) ? Number(v.patient.age) : null;
      pid = (await queryOne<{ id: string }>(`insert into patients (full_name, gender, age_years, phone) values ($1,$2,$3,$4) returning id`,
        [name.slice(0, 160), v.patient.gender || null, age, phone]))!.id;
    }
    let referrer: string | null = null;
    const doc = v.referrer?.trim();
    if (doc) {
      referrer = doctors.get(doc) ?? (await queryOne<{ id: string }>(`select id from referrers where name = $1 limit 1`, [doc]))?.id
        ?? (await queryOne<{ id: string }>(`insert into referrers (name) values ($1) returning id`, [doc.slice(0, 160)]))!.id;
      doctors.set(doc, referrer);
    }
    const at = Number.isFinite(Number(v.created_at)) ? new Date(Number(v.created_at)) : new Date();
    const complete = results.every((r) => String(r.value ?? "").trim());
    const status = v.delivered_at ? "delivered" : complete ? "completed" : "in_progress";
    const order = await queryOne<{ id: string }>(
      `insert into test_orders (patient_id, order_date, created_at, status, accession_no, referrer_id, payment_status, source, total_amount,
                                started_at, completed_at, delivered_at, station_ref, created_by)
       values ($1, $2::timestamptz::date, $2, $3, $4, $5, 'paid', 'lab', 0, $2, case when $3 <> 'in_progress' then $2 end, $6, $7, $8) returning id`,
      [pid, at.toISOString(), status, v.accession ?? null, referrer, v.delivered_at ? new Date(Number(v.delivered_at)).toISOString() : null, ref, u.id]
    );
    for (const r of results) {
      const item = await queryOne<{ id: string }>(`insert into test_order_items (order_id, test_id, price) values ($1, $2, 0) returning id`, [order!.id, map[r.testId]]);
      const value = String(r.value ?? "").trim();
      if (!value) continue;
      const numeric = /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : null;
      await query(
        `insert into test_results (order_item_id, order_id, patient_id, test_id, value_numeric, value_text, hl, result_date)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [item!.id, order!.id, pid, map[r.testId], numeric, numeric == null ? value : null, !!r.hl, at.toISOString()]
      );
    }
    imported++;
  }
  if (imported) await logAudit("station.import", "order", null, { imported, skipped });
  revalidatePath("/orders");
  return { ok: true, imported, skipped };
}
