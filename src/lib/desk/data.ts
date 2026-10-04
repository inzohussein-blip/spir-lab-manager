import "server-only";
import { query, queryOne } from "@/lib/db";
import { ensureDesk } from "./schema";
import { normalOf, DEFAULT_RULES, type DeskTest, type LabOrderData, type LabPrint, type LabRules, type QueueRow, type OrderStatus } from "./types";

const ms = (v: unknown): number | null => (v == null ? null : new Date(String(v)).getTime());

/** The tests, in catalog order (a stopped one stays for the samples that have it, out of the pickers). */
export async function deskCatalog(): Promise<DeskTest[]> {
  await ensureDesk();
  const rows = await query<any>(
    `select id, code, name_ar, name_en, category, sample_type, unit, price, normal, normal_low, normal_high, normal_text,
            critical_low, critical_high, is_active
       from test_catalog order by category nulls last, name_ar`
  );
  return rows.map((r) => ({
    id: r.id, code: r.code ?? "", name_ar: r.name_ar, name_en: r.name_en, category: r.category, sample_type: r.sample_type,
    unit: r.unit, price: Number(r.price ?? 0), normal: normalOf(r),
    critical_low: r.critical_low == null ? null : Number(r.critical_low),
    critical_high: r.critical_high == null ? null : Number(r.critical_high),
    active: r.is_active !== false,
  }));
}

export async function deskReferrers(): Promise<{ id: string; name: string }[]> {
  return query(`select id, name from referrers order by name`).catch(() => []);
}

async function setting(key: string): Promise<string> {
  try {
    return (await queryOne<{ value: string }>(`select value from lab_settings where key = $1`, [key]))?.value ?? "";
  } catch {
    return "";
  }
}

export async function labRules(): Promise<LabRules> {
  try {
    return { ...DEFAULT_RULES, ...(JSON.parse((await setting("lab_rules")) || "{}") as Partial<LabRules>) };
  } catch {
    return DEFAULT_RULES;
  }
}

export async function labPrint(): Promise<LabPrint> {
  try {
    return JSON.parse((await setting("lab_print")) || "{}") as LabPrint;
  } catch {
    return {};
  }
}

/** The samples the lab works on: waiting and in progress (oldest first), then today's finished ones. */
export async function labQueue(): Promise<QueueRow[]> {
  await ensureDesk();
  const rules = await labRules();
  const rows = await query<any>(
    `select o.id, o.accession_no, o.status, o.source, o.created_at, o.verified_by,
            p.full_name,
            (select count(*)::int from test_order_items i where i.order_id = o.id) as tests,
            (select count(*)::int from test_results r where r.order_id = o.id) as done,
            (select max(t.tat_minutes) from test_order_items i join test_catalog t on t.id = i.test_id where i.order_id = o.id) as tat,
            (select count(*)::int from critical_alerts c where c.order_id = o.id and c.ack_at is null) as critical
       from test_orders o join patients p on p.id = o.patient_id
      where o.status in ('pending', 'in_progress')
         or (o.status in ('completed', 'delivered') and o.created_at >= now() - interval '1 day')
      order by case when o.status in ('pending', 'in_progress') then 0 else 1 end, o.created_at
      limit 300`
  );
  return rows.map((r) => ({
    id: r.id, accession: r.accession_no ?? "", name: r.full_name, status: r.status as OrderStatus, source: r.source ?? "desk",
    created_at: ms(r.created_at) ?? 0, tests: r.tests, done: r.done, tat: Number(r.tat ?? rules.tat) || 0,
    awaiting2: rules.twoStep && r.status === "in_progress" && !!r.verified_by, critical: r.critical,
  }));
}

/** One sample with its patient, tests, results and the patient's previous results. */
export async function labOrder(id: string): Promise<LabOrderData | null> {
  await ensureDesk();
  const o = await queryOne<any>(
    `select o.*, p.full_name, p.gender, p.age_years, p.birth_date, p.phone, r.name as referrer_name,
            u1.full_name as v1, u2.full_name as v2
       from test_orders o join patients p on p.id = o.patient_id
       left join referrers r on r.id = o.referrer_id
       left join app_users u1 on u1.id = o.verified_by
       left join app_users u2 on u2.id = o.verified2_by
      where o.id = $1`,
    [id]
  );
  if (!o) return null;
  const items = await query<any>(
    `select i.id as item_id, i.test_id, r.value_numeric, r.value_text, r.flag, r.hl, r.critical
       from test_order_items i join test_catalog t on t.id = i.test_id
       left join test_results r on r.order_item_id = i.id
      where i.order_id = $1 order by t.category nulls last, t.name_ar`,
    [id]
  );
  const prevRows = await query<any>(
    `select distinct on (r.test_id) r.test_id, r.value_numeric, r.value_text, o.created_at
       from test_results r join test_orders o on o.id = r.order_id
      where o.patient_id = $1 and o.id <> $2 and o.created_at < $3
      order by r.test_id, o.created_at desc`,
    [o.patient_id, id, o.created_at]
  );
  const rules = await labRules();
  const crit = await query<any>(
    `select id, test_name, value from critical_alerts where order_id = $1 and ack_at is null order by created_at`,
    [id]
  );
  const val = (r: any) => (r.value_text ?? (r.value_numeric == null ? "" : String(Number(r.value_numeric))));
  let age = o.age_years == null ? "" : String(o.age_years);
  if (!age && o.birth_date) age = String(Math.max(0, Math.floor((Date.now() - new Date(o.birth_date).getTime()) / (365.25 * 86_400_000))));
  return {
    id: o.id,
    accession: o.accession_no ?? "",
    status: o.status,
    source: o.source ?? "desk",
    created_at: ms(o.created_at) ?? 0,
    started_at: ms(o.started_at),
    completed_at: ms(o.completed_at),
    patient: { id: o.patient_id, name: o.full_name, gender: o.gender === "male" || o.gender === "female" ? o.gender : "", age, phone: o.phone ?? "" },
    referrer: o.referrer_name ?? "",
    items: items.map((r) => ({ itemId: r.item_id, testId: r.test_id, value: val(r), hl: !!r.hl, flag: r.flag ?? null, critical: !!r.critical })),
    prev: Object.fromEntries(prevRows.filter((r) => val(r)).map((r) => [r.test_id, { value: val(r), at: ms(r.created_at) ?? 0 }])),
    verifiedBy: o.v1 ?? "",
    verified2By: o.v2 ?? "",
    awaiting2: rules.twoStep && o.status === "in_progress" && !!o.verified_by,
    criticalOpen: crit.map((c) => ({ id: c.id, test: c.test_name, value: c.value })),
  };
}

export interface CollectRow {
  id: string; accession: string; name: string; status: OrderStatus; created_at: number; total: number; paid: number; tests: number;
}

/** Today's samples registered at the collector's desk (or all desks for the admin). */
export async function collectToday(): Promise<CollectRow[]> {
  await ensureDesk();
  const rows = await query<any>(
    `select o.id, o.accession_no, o.status, o.created_at, o.total_amount, p.full_name,
            (select count(*)::int from test_order_items i where i.order_id = o.id) as tests,
            coalesce((select sum(v.paid) from invoices v where v.order_id = o.id and v.status <> 'void'), 0) as paid
       from test_orders o join patients p on p.id = o.patient_id
      where o.source = 'collect' and o.created_at >= date_trunc('day', now())
      order by o.created_at desc limit 300`
  );
  return rows.map((r) => ({
    id: r.id, accession: r.accession_no ?? "", name: r.full_name, status: r.status, created_at: ms(r.created_at) ?? 0,
    total: Number(r.total_amount ?? 0), paid: Number(r.paid ?? 0), tests: r.tests,
  }));
}
