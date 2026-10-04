import "server-only";
import fs from "node:fs";
import path from "node:path";
import { query, mainTx } from "@/lib/db";
import { labTarget, storeOf } from "@/lib/db/lab";

/**
 * Migrations added after a database was made. A lab's own database (or its section of the site's)
 * gets every migration when it is prepared (../db/lab.ts), but one taken over as it was (a copy, or
 * prepared by hand) and the site's own database may not have them: each is applied on first use
 * when its probe (a column it adds) is missing. Every statement in them is idempotent.
 */
const ready = new Map<string, Promise<void>>();
async function ensureMigration(file: string, table: string, column: string): Promise<void> {
  const t = await labTarget();
  if (t && !t.where) return; // no database for this code: its pages say so
  const key = `${t?.key ?? "main"}:${file}`;
  let p = ready.get(key);
  if (!p) {
    p = (async () => {
      const has = await query<{ ok: boolean }>(
        `select exists (select 1 from information_schema.columns
           where table_schema = current_schema() and table_name = $1 and column_name = $2) as ok`,
        [table, column]
      );
      if (has[0]?.ok) return;
      const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", file), "utf8");
      if (t?.where) await (await storeOf(t.where)).tx((c) => c.exec(sql));
      else await mainTx((c) => c.exec(sql));
    })().catch((e) => { ready.delete(key); throw e; });
    ready.set(key, p);
  }
  return p;
}

/** «نافذة ساحب الدم» / «نافذة المختبر» and the workflow (0030). */
export function ensureDesk(): Promise<void> {
  return ensureMigration("0030_desk_workflow.sql", "test_results", "critical");
}

/** Quality control, devices, staff attendance and pay, stocktakes, kits and doctor codes (0031). */
export async function ensureOps(): Promise<void> {
  await ensureDesk();
  return ensureMigration("0031_quality_staff_stock.sql", "test_orders", "station_ref");
}
