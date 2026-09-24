import "server-only";
import { query } from "@/lib/db";

/** Letterhead details the lab types in Settings (printed on reports and receipts). */
export interface LabIdentity { subtitle: string; footer: string }

// Created on first use as well as by migration 0014, so existing databases
// (hosted or embedded) pick it up without a manual migration step.
let ensured: Promise<unknown> | null = null;
function ensureTable() {
  ensured ??= query(
    `create table if not exists lab_settings (
       key text primary key, value text not null default '', updated_at timestamptz not null default now())`
  ).catch((e) => { ensured = null; throw e; });
  return ensured;
}

export async function getLabIdentity(): Promise<LabIdentity> {
  try {
    await ensureTable();
    const rows = await query<{ key: string; value: string }>(
      `select key, value from lab_settings where key in ('lab_subtitle', 'lab_footer')`
    );
    const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() ?? "";
    return { subtitle: get("lab_subtitle"), footer: get("lab_footer") };
  } catch {
    return { subtitle: "", footer: "" }; // printing must never fail over optional letterhead text
  }
}

export async function saveLabIdentity(v: LabIdentity): Promise<void> {
  await ensureTable();
  for (const [key, value] of [["lab_subtitle", v.subtitle], ["lab_footer", v.footer]] as const) {
    await query(
      `insert into lab_settings (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value.trim().slice(0, 300)]
    );
  }
}
