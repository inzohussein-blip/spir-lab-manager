"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { ensureOps } from "@/lib/desk/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";

/** Record a QC run; status auto-derived from deviation vs tolerance (Westgard-lite). */
export async function addQcRun(formData: FormData): Promise<void> {
  const controlName = String(formData.get("control_name") || "").trim();
  if (!controlName) return;
  const target = formData.get("target") ? Number(formData.get("target")) : null;
  const measured = formData.get("measured") ? Number(formData.get("measured")) : null;
  const tolerance = Number(formData.get("tolerance") || 10);

  let status = "pass";
  if (target != null && measured != null && target !== 0) {
    const devPct = (Math.abs(measured - target) / Math.abs(target)) * 100;
    if (devPct > tolerance * 1.5) status = "fail";
    else if (devPct > tolerance) status = "warn";
  }

  const user = await getCurrentUser();
  await query(
    `insert into qc_runs (control_name, analyte, target, measured, tolerance, unit, status, operator, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      controlName,
      (formData.get("analyte") as string) || null,
      target,
      measured,
      tolerance,
      (formData.get("unit") as string) || null,
      status,
      user?.full_name ?? null,
      (formData.get("notes") as string) || null,
    ]
  );
  await logAudit("qc.run", "qc", null, { control: controlName, status });
  revalidatePath("/quality");
}

// ── Daily QC with Westgard rules, temperatures and devices (migration 0031) ───────────────
type Res = { ok: true } | { ok: false; error: string };
async function labUser() {
  const u = await getCurrentUser();
  return u && (u.role === "admin" || u.role === "technician") ? u : null;
}
const ymdOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const n = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export async function qcSaveAnalyte(a: { id?: string; name: string; unit?: string; device?: string; levels: { id: string; label: string; lot?: string; mean: number; sd: number }[]; active?: boolean }): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await ensureOps();
  const name = a.name?.trim().slice(0, 120);
  const levels = (a.levels ?? []).filter((l) => l.label?.trim() && n(l.mean) != null && Number(l.sd) > 0).slice(0, 6)
    .map((l) => ({ id: String(l.id || crypto.randomUUID()).slice(0, 40), label: l.label.trim().slice(0, 40), lot: l.lot?.trim().slice(0, 40) || undefined, mean: Number(l.mean), sd: Number(l.sd) }));
  if (!name || !levels.length) return { ok: false, error: "اكتب اسم التحليل ومستوى واحداً على الأقل بمتوسطه وانحرافه (SD > 0)." };
  if (a.id) {
    await query(`update qc_analytes set name=$1, unit=$2, device=$3, levels=$4, active=$5 where id=$6`,
      [name, a.unit?.trim() || null, a.device?.trim() || null, JSON.stringify(levels), a.active !== false, a.id]);
  } else {
    await query(`insert into qc_analytes (name, unit, device, levels) values ($1,$2,$3,$4)`, [name, a.unit?.trim() || null, a.device?.trim() || null, JSON.stringify(levels)]);
  }
  revalidatePath("/quality");
  return { ok: true };
}

export async function qcDeleteAnalyte(id: string): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await query(`delete from qc_analytes where id = $1`, [id]);
  revalidatePath("/quality");
  return { ok: true };
}

/** One level's value for a day (the level's targets kept with it); empty removes it. */
export async function qcSetResult(analyteId: string, levelId: string, date: string, value: string): Promise<Res> {
  const u = await labUser();
  if (!u) return { ok: false, error: "للمختبر فقط." };
  if (!ymdOk(date)) return { ok: false, error: "تاريخ غير صحيح." };
  await ensureOps();
  if (value.trim() === "") {
    await query(`delete from qc_results where analyte_id=$1 and level_id=$2 and run_date=$3`, [analyteId, levelId, date]);
  } else {
    const v = n(value.trim());
    if (v == null) return { ok: false, error: "اكتب رقماً." };
    const a = await queryOne<{ levels: { id: string; mean: number; sd: number }[] }>(`select levels from qc_analytes where id = $1`, [analyteId]);
    const lv = a?.levels?.find((l) => l.id === levelId);
    if (!lv) return { ok: false, error: "المستوى غير موجود." };
    await query(
      `insert into qc_results (analyte_id, level_id, run_date, value, mean, sd, by_name) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (analyte_id, level_id, run_date) do update set value = excluded.value, by_name = excluded.by_name, at = now()`,
      [analyteId, levelId, date, v, lv.mean, lv.sd, u.full_name]
    );
  }
  revalidatePath("/quality");
  return { ok: true };
}

export async function tempSaveUnit(t: { id?: string; name: string; kind?: string; min: number; max: number }): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await ensureOps();
  const min = n(t.min), max = n(t.max);
  if (!t.name?.trim() || min == null || max == null || min >= max) return { ok: false, error: "اكتب الاسم والحدين (الأدنى أصغر من الأعلى)." };
  if (t.id) await query(`update temp_units set name=$1, kind=$2, min_c=$3, max_c=$4 where id=$5`, [t.name.trim(), t.kind?.trim() || null, min, max, t.id]);
  else await query(`insert into temp_units (name, kind, min_c, max_c) values ($1,$2,$3,$4)`, [t.name.trim(), t.kind?.trim() || null, min, max]);
  revalidatePath("/quality");
  return { ok: true };
}

export async function tempDeleteUnit(id: string): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await query(`delete from temp_units where id = $1`, [id]);
  revalidatePath("/quality");
  return { ok: true };
}

export async function tempSet(unitId: string, date: string, slot: "AM" | "PM", value: string, action?: string): Promise<Res> {
  const u = await labUser();
  if (!u) return { ok: false, error: "للمختبر فقط." };
  if (!ymdOk(date) || (slot !== "AM" && slot !== "PM")) return { ok: false, error: "قيمة غير صحيحة." };
  await ensureOps();
  if (value.trim() === "") {
    await query(`delete from temp_readings where unit_id=$1 and read_date=$2 and slot=$3`, [unitId, date, slot]);
  } else {
    const v = n(value.trim());
    if (v == null) return { ok: false, error: "اكتب رقماً." };
    await query(
      `insert into temp_readings (unit_id, read_date, slot, value, by_name, action) values ($1,$2,$3,$4,$5,$6)
       on conflict (unit_id, read_date, slot) do update set value = excluded.value, by_name = excluded.by_name, action = coalesce(excluded.action, temp_readings.action)`,
      [unitId, date, slot, v, u.full_name, action?.trim() || null]
    );
  }
  revalidatePath("/quality");
  return { ok: true };
}

const FREQS = ["daily", "weekly", "monthly", "quarterly", "yearly"];
export async function deviceSave(d: { id?: string; name: string; model?: string; serial?: string; calibMonths?: number | null; lastCalib?: string | null; tasks: { id: string; name: string; freq: string; lastDone?: string }[] }): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await ensureOps();
  if (!d.name?.trim()) return { ok: false, error: "اكتب اسم الجهاز." };
  const tasks = (d.tasks ?? []).filter((t) => t.name?.trim() && FREQS.includes(t.freq)).slice(0, 30)
    .map((t) => ({ id: String(t.id || crypto.randomUUID()).slice(0, 40), name: t.name.trim().slice(0, 120), freq: t.freq, ...(t.lastDone && ymdOk(t.lastDone) ? { lastDone: t.lastDone } : {}) }));
  const months = n(d.calibMonths);
  const last = d.lastCalib && ymdOk(d.lastCalib) ? d.lastCalib : null;
  const args = [d.name.trim().slice(0, 120), d.model?.trim() || null, d.serial?.trim() || null, months == null ? null : Math.round(months), last, JSON.stringify(tasks)];
  if (d.id) await query(`update lab_devices set name=$1, model=$2, serial=$3, calib_months=$4, last_calib=$5, tasks=$6 where id=$7`, [...args, d.id]);
  else await query(`insert into lab_devices (name, model, serial, calib_months, last_calib, tasks) values ($1,$2,$3,$4,$5,$6)`, args);
  revalidatePath("/quality");
  return { ok: true };
}

export async function deviceDelete(id: string): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await query(`delete from lab_devices where id = $1`, [id]);
  revalidatePath("/quality");
  return { ok: true };
}

/** A maintenance task done today (logged). */
export async function deviceTaskDone(deviceId: string, taskId: string): Promise<Res> {
  const u = await labUser();
  if (!u) return { ok: false, error: "للمختبر فقط." };
  await ensureOps();
  const d = await queryOne<{ tasks: { id: string; name: string; lastDone?: string }[] }>(`select tasks from lab_devices where id = $1`, [deviceId]);
  const t = d?.tasks?.find((x) => x.id === taskId);
  if (!d || !t) return { ok: false, error: "المهمة غير موجودة." };
  const today = (await queryOne<{ d: string }>(`select current_date::text as d`))!.d;
  const tasks = d.tasks.map((x) => (x.id === taskId ? { ...x, lastDone: today } : x));
  await query(`update lab_devices set tasks = $1 where id = $2`, [JSON.stringify(tasks), deviceId]);
  await query(`insert into device_logs (device_id, type, text, by_name) values ($1, 'maintenance', $2, $3)`, [deviceId, t.name, u.full_name]);
  revalidatePath("/quality");
  return { ok: true };
}

/** A fault, a maintenance or a calibration written in the device's log (a calibration renews its date). */
export async function deviceLog(deviceId: string, l: { type: string; text: string; action?: string; downtime?: number | null }): Promise<Res> {
  const u = await labUser();
  if (!u) return { ok: false, error: "للمختبر فقط." };
  await ensureOps();
  if (!["maintenance", "fault", "calibration"].includes(l.type) || !l.text?.trim()) return { ok: false, error: "اكتب الوصف." };
  await query(`insert into device_logs (device_id, type, text, action, downtime, resolved, by_name) values ($1,$2,$3,$4,$5,$6,$7)`,
    [deviceId, l.type, l.text.trim().slice(0, 500), l.action?.trim() || null, n(l.downtime), l.type !== "fault", u.full_name]);
  if (l.type === "calibration") await query(`update lab_devices set last_calib = current_date where id = $1`, [deviceId]);
  revalidatePath("/quality");
  return { ok: true };
}

export async function deviceResolve(logId: string, action: string): Promise<Res> {
  if (!(await labUser())) return { ok: false, error: "للمختبر فقط." };
  await query(`update device_logs set resolved = true, action = coalesce(nullif($2, ''), action) where id = $1`, [logId, action.trim()]);
  revalidatePath("/quality");
  return { ok: true };
}
