"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { ensureOps } from "@/lib/desk/schema";
import { hasRole } from "@/lib/auth/guard";

export async function addStaff(formData: FormData): Promise<void> {
  if (!(await hasRole())) return; // admin only
  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) return;
  await query(
    `insert into staff (full_name, role, phone) values ($1, $2, $3)`,
    [
      full_name,
      (formData.get("role") as string) || null,
      (formData.get("phone") as string) || null,
    ]
  );
  revalidatePath("/staff");
}

export async function addCoverShift(formData: FormData): Promise<void> {
  if (!(await hasRole())) return; // admin only
  const cover_date = String(formData.get("cover_date") || "");
  if (!cover_date) return;
  await query(
    `insert into cover_shifts (cover_date, original_staff_id, cover_staff_id, reason)
     values ($1, $2, $3, $4)`,
    [
      cover_date,
      (formData.get("original_staff_id") as string) || null,
      (formData.get("cover_staff_id") as string) || null,
      (formData.get("reason") as string) || null,
    ]
  );
  revalidatePath("/staff");
}

// ── Attendance, leaves, advances and pay (migration 0031) ──────────────────────────────
const ymdOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const STATUSES = ["present", "late", "absent", "leave"];

export async function setSalary(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  await ensureOps();
  const id = String(formData.get("staff_id") || "");
  const salary = Math.max(0, Number(formData.get("salary") || 0)) || 0;
  if (!id) return;
  await query(`update staff set salary = $1 where id = $2`, [salary, id]);
  revalidatePath("/staff");
  revalidatePath("/staff/payroll");
}

/** «حضور» / «انصراف» now, or a day's status set by hand. */
export async function markAttendance(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  await ensureOps();
  const staffId = String(formData.get("staff_id") || "");
  const date = String(formData.get("date") || "");
  const op = String(formData.get("op") || "");
  if (!staffId || !ymdOk(date)) return;
  if (op === "in") {
    const late = String(formData.get("late_after") || "");
    await query(
      `insert into attendance (staff_id, work_date, check_in, status) values ($1, $2, localtime(0),
         case when localtime(0) > nullif($3, '')::time then 'late' else 'present' end)
       on conflict (staff_id, work_date) do update set check_in = coalesce(attendance.check_in, excluded.check_in),
         status = case when attendance.status in ('absent', 'leave') then excluded.status else attendance.status end`,
      [staffId, date, /^\d{2}:\d{2}$/.test(late) ? late : ""]
    );
  } else if (op === "out") {
    await query(
      `insert into attendance (staff_id, work_date, check_out) values ($1, $2, localtime(0))
       on conflict (staff_id, work_date) do update set check_out = excluded.check_out`,
      [staffId, date]
    );
  } else if (STATUSES.includes(op)) {
    await query(
      `insert into attendance (staff_id, work_date, status) values ($1, $2, $3)
       on conflict (staff_id, work_date) do update set status = excluded.status`,
      [staffId, date, op]
    );
  } else if (op === "clear") {
    await query(`delete from attendance where staff_id = $1 and work_date = $2`, [staffId, date]);
  }
  revalidatePath("/staff/attendance");
}

export async function addLeave(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  await ensureOps();
  const staffId = String(formData.get("staff_id") || "");
  const from = String(formData.get("from_date") || "");
  const to = String(formData.get("to_date") || from);
  if (!staffId || !ymdOk(from) || !ymdOk(to) || to < from) return;
  await query(`insert into staff_leaves (staff_id, from_date, to_date, kind, paid, note) values ($1,$2,$3,$4,$5,$6)`, [
    staffId, from, to, String(formData.get("kind") || "annual").slice(0, 40), formData.get("paid") !== "0", (formData.get("note") as string)?.trim() || null,
  ]);
  revalidatePath("/staff/leaves");
  revalidatePath("/staff/payroll");
}

export async function deleteLeave(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  await query(`delete from staff_leaves where id = $1`, [String(formData.get("id") || "")]);
  revalidatePath("/staff/leaves");
  revalidatePath("/staff/payroll");
}

export async function addAdvance(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  await ensureOps();
  const staffId = String(formData.get("staff_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const on = String(formData.get("given_on") || "");
  if (!staffId || !(amount > 0)) return;
  await query(`insert into staff_advances (staff_id, amount, given_on, note) values ($1, $2, coalesce($3::date, current_date), $4)`, [
    staffId, amount, ymdOk(on) ? on : null, (formData.get("note") as string)?.trim() || null,
  ]);
  revalidatePath("/staff/leaves");
  revalidatePath("/staff/payroll");
}

export async function deleteAdvance(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  await query(`delete from staff_advances where id = $1`, [String(formData.get("id") || "")]);
  revalidatePath("/staff/leaves");
  revalidatePath("/staff/payroll");
}

/** The time work starts: a check-in after it counts as «متأخر» (empty: never). */
export async function setWorkStart(formData: FormData): Promise<void> {
  if (!(await hasRole())) return;
  const t = String(formData.get("work_start") || "");
  await query(`create table if not exists lab_settings (key text primary key, value text not null default '', updated_at timestamptz not null default now())`);
  await query(
    `insert into lab_settings (key, value) values ('work_start', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [/^\d{2}:\d{2}$/.test(t) ? t : ""]
  );
  revalidatePath("/staff/attendance");
}
