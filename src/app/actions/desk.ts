"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { labTarget } from "@/lib/db/lab";
import { getLabIdentity, labName } from "@/lib/lab-identity";
import { waLink } from "@/lib/whatsapp";
import { query, queryOne } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ensureDesk } from "@/lib/desk/schema";
import { labOrder, labRules } from "@/lib/desk/data";
import { publishForReferrer, publishCode, revokeCode, type CodeRow } from "@/lib/desk/doctors";
import { ensureOps } from "@/lib/desk/schema";
import { newDoctorCode, doctorKeys, type DoctorWindow } from "@/lib/doctors/code";
import { isCritical, type DeskPatient, type LabOrderData, type LabPrint, type LabRules } from "@/lib/desk/types";

/**
 * «نافذة ساحب الدم» (registers the patient and the tests with their prices, takes the money and
 * gives the receipt) and «نافذة المختبر» (the collector's samples, or new ones entered directly
 * without prices; results like the lab station; verification and delivery).
 */
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function who(...roles: string[]) {
  const u = await getCurrentUser();
  if (!u) return null;
  return u.role === "admin" || roles.includes(u.role) ? u : null;
}

function accessionNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `LAB-${ymd}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}
function invoiceNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INV-${ymd}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}
const METHODS = ["cash", "card", "transfer"];
const money = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/** Patients by name or phone, for the windows' search box. */
export async function deskFindPatients(q: string): Promise<{ id: string; name: string; gender: string; age: string; phone: string }[]> {
  if (!(await who("reception", "collector", "technician"))) return [];
  const s = q.trim();
  if (s.length < 2) return [];
  const rows = await query<any>(
    `select id, full_name, gender, age_years, phone from patients
      where full_name ilike $1 or phone ilike $1 order by created_at desc limit 12`,
    [`%${s.replace(/[%_]/g, "")}%`]
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name, gender: r.gender ?? "", age: r.age_years == null ? "" : String(r.age_years), phone: r.phone ?? "" }));
}

async function patientId(p: DeskPatient): Promise<string | null> {
  if (p.id) return (await queryOne<{ id: string }>(`select id from patients where id = $1`, [p.id]))?.id ?? null;
  const name = p.name.trim().slice(0, 160);
  if (!name) return null;
  const age = /^\d{1,3}$/.test(p.age.trim()) ? Number(p.age.trim()) : null;
  const row = await queryOne<{ id: string }>(
    `insert into patients (full_name, gender, age_years, phone) values ($1, $2, $3, $4) returning id`,
    [name, p.gender || null, age, p.phone.trim().slice(0, 40) || null]
  );
  await logAudit("patient.created", "patient", row!.id, { name });
  return row!.id;
}

async function catalogPrices(testIds: string[]): Promise<{ id: string; name_ar: string; price: number }[]> {
  const ids = [...new Set(testIds.filter(Boolean))].slice(0, 200);
  if (!ids.length) return [];
  const rows = await query<any>(`select id, name_ar, price from test_catalog where id = any($1) and is_active`, [ids]);
  return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r.id, name_ar: r.name_ar, price: Number(r.price ?? 0) }));
}

/** «نافذة ساحب الدم»: a new sample with its tests at their prices, the money taken (an invoice and
 *  its payment, so the cash box and debts see it), waiting for the lab. */
export async function collectSample(input: {
  patient: DeskPatient; testIds: string[]; referrerId?: string | null; discount?: number; paid?: number; method?: string; notes?: string;
}): Promise<Res<{ orderId: string; accession: string }>> {
  const u = await who("reception", "collector");
  if (!u) return { ok: false, error: "لا تملك صلاحية تسجيل العيّنات." };
  await ensureDesk();
  const tests = await catalogPrices(input.testIds);
  if (!tests.length) return { ok: false, error: "اختر فحصاً واحداً على الأقل." };
  const pid = await patientId(input.patient);
  if (!pid) return { ok: false, error: "اكتب اسم المراجع." };
  const subtotal = tests.reduce((s, t) => s + t.price, 0);
  const discount = Math.min(money(input.discount), subtotal);
  const total = subtotal - discount;
  const paid = Math.min(money(input.paid), total);
  const method = METHODS.includes(String(input.method)) ? String(input.method) : "cash";
  const status = paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : total === 0 ? "paid" : "unpaid";
  const accession = accessionNo();
  const order = await queryOne<{ id: string }>(
    `insert into test_orders (patient_id, status, accession_no, referrer_id, payment_status, payment_method, source, discount, total_amount, notes, created_by)
     values ($1, 'pending', $2, $3, $4, $5, 'collect', $6, $7, $8, $9) returning id`,
    [pid, accession, input.referrerId || null, status, status === "unpaid" ? null : method, discount, total, input.notes?.trim().slice(0, 500) || null, u.id]
  );
  const orderId = order!.id;
  for (const t of tests) await query(`insert into test_order_items (order_id, test_id, price) values ($1, $2, $3)`, [orderId, t.id, t.price]);
  const inv = await queryOne<{ id: string }>(
    `insert into invoices (invoice_no, order_id, patient_id, subtotal, discount, total, paid, status, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [invoiceNo(), orderId, pid, subtotal, discount, total, paid, status, u.id]
  );
  for (const t of tests) {
    await query(`insert into invoice_items (invoice_id, description, quantity, unit_price, amount) values ($1, $2, 1, $3, $3)`, [inv!.id, t.name_ar, t.price]);
  }
  if (paid > 0) await query(`insert into payments (invoice_id, amount, method) values ($1, $2, $3)`, [inv!.id, paid, method]);
  await logAudit("order.collected", "order", orderId, { tests: tests.length, total, paid });
  revalidatePath("/collect");
  revalidatePath("/lab");
  return { ok: true, orderId, accession };
}

/** The rest of a sample's bill paid at the collector's desk. */
export async function collectPay(orderId: string, amount: number, method: string): Promise<Res> {
  if (!(await who("reception", "collector"))) return { ok: false, error: "لا تملك الصلاحية." };
  const inv = await queryOne<any>(`select id, total, paid from invoices where order_id = $1 and status <> 'void' limit 1`, [orderId]);
  if (!inv) return { ok: false, error: "لا توجد فاتورة لهذه العيّنة." };
  const add = Math.min(money(amount), Math.max(0, Number(inv.total) - Number(inv.paid)));
  if (!add) return { ok: false, error: "لا يوجد مبلغ متبقٍّ." };
  const m = METHODS.includes(method) ? method : "cash";
  await query(`insert into payments (invoice_id, amount, method) values ($1, $2, $3)`, [inv.id, add, m]);
  const paid = Number(inv.paid) + add;
  const status = paid >= Number(inv.total) ? "paid" : "partial";
  await query(`update invoices set paid = $1, status = $2 where id = $3`, [paid, status, inv.id]);
  await query(`update test_orders set payment_status = $1, payment_method = $2 where id = $3`, [status, m, orderId]);
  await logAudit("payment.recorded", "invoice", inv.id, { amount: add });
  revalidatePath("/collect");
  return { ok: true };
}

/** «نافذة المختبر»: a sample entered directly at the lab, like the lab station — no prices. */
export async function labNewSample(input: { patient: DeskPatient; testIds: string[]; referrerId?: string | null }): Promise<Res<{ orderId: string }>> {
  const u = await who("technician");
  if (!u) return { ok: false, error: "لا تملك صلاحية المختبر." };
  await ensureDesk();
  const tests = await catalogPrices(input.testIds);
  if (!tests.length) return { ok: false, error: "اختر فحصاً واحداً على الأقل." };
  const pid = await patientId(input.patient);
  if (!pid) return { ok: false, error: "اكتب اسم المراجع." };
  const order = await queryOne<{ id: string }>(
    `insert into test_orders (patient_id, status, accession_no, referrer_id, payment_status, source, total_amount, started_at, created_by)
     values ($1, 'in_progress', $2, $3, 'paid', 'lab', 0, now(), $4) returning id`,
    [pid, accessionNo(), input.referrerId || null, u.id]
  );
  for (const t of tests) await query(`insert into test_order_items (order_id, test_id, price) values ($1, $2, 0)`, [order!.id, t.id]);
  await logAudit("order.created", "order", order!.id, { tests: tests.length, source: "lab" });
  revalidatePath("/lab");
  return { ok: true, orderId: order!.id };
}

export async function labLoadOrder(id: string): Promise<LabOrderData | null> {
  if (!(await who("technician"))) return null;
  return labOrder(id);
}

/** Find a sample by its number (typed or scanned). */
export async function labFind(accession: string): Promise<string | null> {
  if (!(await who("technician", "reception", "collector"))) return null;
  const a = accession.trim().toUpperCase();
  if (!a) return null;
  return (await queryOne<{ id: string }>(`select id from test_orders where upper(accession_no) = $1 limit 1`, [a]))?.id ?? null;
}

/** Tests added at the lab (no price: the bill stays as the desk made it). */
export async function labAddTests(orderId: string, testIds: string[]): Promise<Res> {
  if (!(await who("technician"))) return { ok: false, error: "لا تملك صلاحية المختبر." };
  const o = await queryOne<{ status: string }>(`select status from test_orders where id = $1`, [orderId]);
  if (!o) return { ok: false, error: "العيّنة غير موجودة." };
  if (o.status === "completed" || o.status === "delivered") return { ok: false, error: "النتائج معتمدة؛ أعد فتحها أولاً." };
  const have = new Set((await query<{ test_id: string }>(`select test_id from test_order_items where order_id = $1`, [orderId])).map((r) => r.test_id));
  const tests = (await catalogPrices(testIds)).filter((t) => !have.has(t.id));
  for (const t of tests) await query(`insert into test_order_items (order_id, test_id, price) values ($1, $2, 0)`, [orderId, t.id]);
  if (tests.length) await logAudit("order.tests_added", "order", orderId, { tests: tests.length });
  return { ok: true };
}

/** A test with no result removed from a sample entered at the lab. */
export async function labRemoveTest(orderId: string, itemId: string): Promise<Res> {
  if (!(await who("technician"))) return { ok: false, error: "لا تملك صلاحية المختبر." };
  const o = await queryOne<{ source: string; status: string }>(`select source, status from test_orders where id = $1`, [orderId]);
  if (!o || o.source !== "lab" || o.status === "completed" || o.status === "delivered") return { ok: false, error: "لا يمكن حذف فحص من هذه العيّنة." };
  const n = await query(`delete from test_order_items i where i.id = $1 and i.order_id = $2
     and not exists (select 1 from test_results r where r.order_item_id = i.id) returning i.id`, [itemId, orderId]);
  return n.length ? { ok: true } : { ok: false, error: "للفحص نتيجة؛ امسحها أولاً." };
}

/** Save the results typed at the lab (the flag worked out on the page, as the lab station does). */
export async function labSaveResults(orderId: string, rows: { itemId: string; value: string; flag: string | null; hl: boolean }[]): Promise<Res<{ critical: number }>> {
  const u = await who("technician");
  if (!u) return { ok: false, error: "لا تملك صلاحية المختبر." };
  await ensureDesk();
  const o = await queryOne<{ status: string; patient_id: string; verified_by: string | null }>(`select status, patient_id, verified_by from test_orders where id = $1`, [orderId]);
  if (!o) return { ok: false, error: "العيّنة غير موجودة." };
  if (o.status === "completed" || o.status === "delivered") return { ok: false, error: "النتائج معتمدة؛ أعد فتحها أولاً للتعديل." };
  const items = await query<any>(
    `select i.id, i.test_id, t.name_ar, t.critical_low, t.critical_high, r.value_numeric, r.value_text
       from test_order_items i join test_catalog t on t.id = i.test_id
       left join test_results r on r.order_item_id = i.id where i.order_id = $1`,
    [orderId]
  );
  let critical = 0;
  for (const row of rows.slice(0, 300)) {
    const it = items.find((x) => x.id === row.itemId);
    if (!it) continue;
    const value = String(row.value ?? "").slice(0, 20000);
    const before = it.value_text ?? (it.value_numeric == null ? "" : String(Number(it.value_numeric)));
    if (!value.trim()) {
      await query(`delete from test_results where order_item_id = $1`, [it.id]);
      continue;
    }
    const numeric = /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : null;
    const flag = row.flag === "H" || row.flag === "L" || row.flag === "N" ? row.flag : null;
    const crit = isCritical(value, { critical_low: it.critical_low == null ? null : Number(it.critical_low), critical_high: it.critical_high == null ? null : Number(it.critical_high) });
    await query(`delete from test_results where order_item_id = $1`, [it.id]);
    await query(
      `insert into test_results (order_item_id, order_id, patient_id, test_id, value_numeric, value_text, flag, hl, critical)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [it.id, orderId, o.patient_id, it.test_id, numeric, numeric == null ? value : null, flag, !!row.hl, crit]
    );
    if (crit) {
      critical++;
      if (before.trim() !== value.trim()) {
        await query(`insert into critical_alerts (order_id, test_id, test_name, value) values ($1, $2, $3, $4)`, [orderId, it.test_id, it.name_ar, value.trim()]);
      }
    }
  }
  // Results changed after a first verification: it has to be done again.
  await query(
    `update test_orders set status = 'in_progress', started_at = coalesce(started_at, now()), verified_by = null where id = $1`,
    [orderId]
  );
  await logAudit("result.saved", "order", orderId, { rows: rows.length });
  revalidatePath("/lab");
  return { ok: true, critical };
}

/** Start work on a sample that came from the collector. */
export async function labStart(orderId: string): Promise<Res> {
  if (!(await who("technician"))) return { ok: false, error: "لا تملك صلاحية المختبر." };
  await ensureDesk();
  await query(`update test_orders set status = 'in_progress', started_at = coalesce(started_at, now()) where id = $1 and status = 'pending'`, [orderId]);
  revalidatePath("/lab");
  return { ok: true };
}

/** Verify the results: final at once, or — when the lab asks for a second check — after a second person. */
export async function labVerify(orderId: string): Promise<Res<{ final: boolean }>> {
  const u = await who("technician");
  if (!u) return { ok: false, error: "لا تملك صلاحية المختبر." };
  await ensureDesk();
  const o = await queryOne<any>(
    `select o.status, o.verified_by,
            (select count(*)::int from test_order_items i where i.order_id = o.id) as tests,
            (select count(*)::int from test_results r where r.order_id = o.id) as done,
            (select count(*)::int from critical_alerts c where c.order_id = o.id and c.ack_at is null) as critical
       from test_orders o where o.id = $1`,
    [orderId]
  );
  if (!o) return { ok: false, error: "العيّنة غير موجودة." };
  if (o.status === "completed" || o.status === "delivered") return { ok: false, error: "النتائج معتمدة من قبل." };
  if (!o.tests || o.done < o.tests) return { ok: false, error: `${o.tests - o.done} فحص بلا نتيجة بعد.` };
  if (o.critical > 0) return { ok: false, error: "سجّل إبلاغ القيم الحرجة أولاً." };
  const rules = await labRules();
  if (rules.twoStep && !o.verified_by) {
    await query(`update test_orders set verified_by = $1 where id = $2`, [u.id, orderId]);
    await logAudit("order.verified1", "order", orderId);
    revalidatePath("/lab");
    return { ok: true, final: false };
  }
  if (rules.twoStep && o.verified_by === u.id) return { ok: false, error: "الاعتماد الثاني يكون من شخص آخر." };
  await query(
    `update test_orders set status = 'completed', completed_at = now(),
        verified_by = coalesce(verified_by, $1), verified2_by = case when $2 then $1 else null end, verified2_at = case when $2 then now() else null end
      where id = $3`,
    [u.id, rules.twoStep, orderId]
  );
  await query(`update test_results set verified_by = $1 where order_id = $2`, [u.id, orderId]);
  await logAudit("order.verified", "order", orderId);
  // The referring doctor's copy in «نافذة الأطباء».
  await publishForReferrer((await queryOne<{ r: string | null }>(`select referrer_id as r from test_orders where id = $1`, [orderId]))?.r);
  revalidatePath("/lab");
  revalidatePath("/release");
  return { ok: true, final: true };
}

/** Reopen verified results to change them (the manager). */
export async function labReopen(orderId: string): Promise<Res> {
  if (!(await who())) return { ok: false, error: "إعادة الفتح للمدير فقط." };
  await ensureDesk();
  await query(
    `update test_orders set status = 'in_progress', completed_at = null, delivered_at = null, verified_by = null, verified2_by = null, verified2_at = null
      where id = $1`,
    [orderId]
  );
  await logAudit("order.reopened", "order", orderId);
  revalidatePath("/lab");
  return { ok: true };
}

/** The results handed to the patient. */
export async function deskDeliver(orderId: string): Promise<Res> {
  if (!(await who("technician", "reception", "collector"))) return { ok: false, error: "لا تملك الصلاحية." };
  await ensureDesk();
  const r = await query(`update test_orders set status = 'delivered', delivered_at = now() where id = $1 and status = 'completed' returning id`, [orderId]);
  if (!r.length) return { ok: false, error: "تُسلَّم النتائج بعد اعتمادها." };
  await logAudit("order.delivered", "order", orderId);
  await publishForReferrer((await queryOne<{ r: string | null }>(`select referrer_id as r from test_orders where id = $1`, [orderId]))?.r);
  revalidatePath("/lab");
  revalidatePath("/collect");
  return { ok: true };
}

/** «القيم الحرجة»: who was told, and when. */
export async function ackCritical(alertId: string, to: string): Promise<Res> {
  const u = await who("technician");
  if (!u) return { ok: false, error: "لا تملك صلاحية المختبر." };
  const told = to.trim().slice(0, 200);
  if (!told) return { ok: false, error: "اكتب من أُبلغ (الطبيب أو المراجع)." };
  await query(`update critical_alerts set ack_by = $1, ack_name = $2, ack_to = $3, ack_at = now() where id = $4 and ack_at is null`, [u.id, u.full_name, told, alertId]);
  await logAudit("critical.ack", "critical", alertId, { to: told });
  revalidatePath("/lab");
  return { ok: true };
}

async function putSetting(key: string, value: string) {
  await query(`create table if not exists lab_settings (key text primary key, value text not null default '', updated_at timestamptz not null default now())`);
  await query(
    `insert into lab_settings (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value]
  );
}

/** The lab window's print options (the manager). */
export async function saveLabPrint(p: LabPrint): Promise<Res> {
  if (!(await who())) return { ok: false, error: "للمدير فقط." };
  const json = JSON.stringify(p ?? {});
  if (json.length > 200_000) return { ok: false, error: "الإعدادات كبيرة جداً." };
  await putSetting("lab_print", json);
  revalidatePath("/lab");
  return { ok: true };
}

/** Second verification and the waiting limit (the manager). */
export async function saveLabRules(r: LabRules): Promise<Res> {
  if (!(await who())) return { ok: false, error: "للمدير فقط." };
  await putSetting("lab_rules", JSON.stringify({ twoStep: !!r.twoStep, tat: Math.max(0, Math.min(10080, Math.round(Number(r.tat) || 0))) }));
  revalidatePath("/lab");
  return { ok: true };
}

/** «إشعار المراجع»: a WhatsApp message on the patient's number that the results are ready, with the
 *  link that shows they are genuine (the report's QR code opens the same page). */
export async function notifyReady(orderId: string): Promise<Res<{ link: string }>> {
  if (!(await who("technician", "reception", "collector"))) return { ok: false, error: "لا تملك الصلاحية." };
  const o = await queryOne<any>(
    `select o.patient_id, o.status, o.accession_no, p.full_name, p.phone from test_orders o join patients p on p.id = o.patient_id where o.id = $1`,
    [orderId]
  );
  if (!o) return { ok: false, error: "العيّنة غير موجودة." };
  if (o.status !== "completed" && o.status !== "delivered") return { ok: false, error: "يُرسل الإشعار بعد اعتماد النتائج." };
  if (!o.phone) return { ok: false, error: "لا يوجد رقم هاتف للمراجع." };
  let token = (await queryOne<{ qr_token: string }>(`select qr_token from reports where order_id = $1 limit 1`, [orderId]))?.qr_token;
  token ??= (await queryOne<{ qr_token: string }>(`insert into reports (order_id, patient_id) values ($1, $2) returning qr_token`, [orderId, o.patient_id]))!.qr_token;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const base = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${h.get("x-forwarded-proto") || "https"}://${host}` : "");
  const lab = await labTarget();
  const url = `${base}/verify/${token}${lab ? `?l=${encodeURIComponent(lab.lid)}` : ""}`;
  const name = labName(await getLabIdentity());
  const text = `مرحباً ${o.full_name}، نتائج تحاليلك (${o.accession_no ?? ""}) جاهزة في ${name}.\nللتحقق من التقرير: ${url}`;
  await query(`insert into whatsapp_log (patient_id, order_id, phone, channel, status) values ($1, $2, $3, 'wa_link', 'queued')`, [o.patient_id, orderId, o.phone]).catch(() => undefined);
  await logAudit("report.notified", "order", orderId);
  return { ok: true, link: waLink(o.phone, text) };
}

// ── «نافذة الأطباء» from the admin panel (the manager) ─────────────────────────────────
const WINDOWS: DoctorWindow[] = ["day", "week", "month", "year"];

/** A code for a referring doctor (a new one replaces his old one, which stops working). */
export async function createDoctorCode(referrerId: string, win: string, hidePhone: boolean): Promise<Res<{ code: string; error?: string }>> {
  if (!(await who())) return { ok: false, error: "للمدير فقط." };
  await ensureOps();
  if (!(await queryOne(`select 1 from referrers where id = $1`, [referrerId]))) return { ok: false, error: "الطبيب غير موجود." };
  const old = await query<CodeRow>(`select id, referrer_id, code, tag, win, hide_phone from doctor_codes where referrer_id = $1`, [referrerId]);
  for (const o of old) await revokeCode(o);
  await query(`delete from doctor_codes where referrer_id = $1`, [referrerId]);
  const code = newDoctorCode();
  const row = await queryOne<CodeRow>(
    `insert into doctor_codes (referrer_id, code, tag, win, hide_phone) values ($1, $2, $3, $4, $5) returning id, referrer_id, code, tag, win, hide_phone`,
    [referrerId, code, doctorKeys(code).tag, WINDOWS.includes(win as DoctorWindow) ? win : "month", !!hidePhone]
  );
  const r = await publishCode(row!);
  await logAudit("doctor_code.created", "referrer", referrerId);
  revalidatePath("/referrers/codes");
  return { ok: true, code, ...(r.ok ? {} : { error: r.error }) };
}

export async function revokeDoctorCode(id: string): Promise<Res> {
  if (!(await who())) return { ok: false, error: "للمدير فقط." };
  await ensureOps();
  const row = await queryOne<CodeRow>(`select id, referrer_id, code, tag, win, hide_phone from doctor_codes where id = $1`, [id]);
  if (row) await revokeCode(row);
  await query(`delete from doctor_codes where id = $1`, [id]);
  await logAudit("doctor_code.revoked", "referrer", row?.referrer_id ?? null);
  revalidatePath("/referrers/codes");
  return { ok: true };
}

/** Renew every doctor's copy now. */
export async function refreshDoctorCodes(): Promise<Res<{ failed: number }>> {
  if (!(await who())) return { ok: false, error: "للمدير فقط." };
  await ensureOps();
  let failed = 0;
  for (const row of await query<CodeRow>(`select id, referrer_id, code, tag, win, hide_phone from doctor_codes`)) {
    if (!(await publishCode(row)).ok) failed++;
  }
  revalidatePath("/referrers/codes");
  return { ok: true, failed };
}

/** Show a doctor's code again (kept by the lab so its results can be sealed). */
export async function showDoctorCode(id: string): Promise<Res<{ code: string }>> {
  if (!(await who())) return { ok: false, error: "للمدير فقط." };
  const row = await queryOne<{ code: string }>(`select code from doctor_codes where id = $1`, [id]);
  if (!row) return { ok: false, error: "الرمز غير موجود." };
  await logAudit("doctor_code.shown", "doctor_code", id);
  return { ok: true, code: row.code };
}
