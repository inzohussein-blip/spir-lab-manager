import Link from "next/link";
import { queryOne } from "@/lib/db";
import { ensureOps } from "@/lib/desk/schema";
import { labRules } from "@/lib/desk/data";

/** «يومي»: what this role has to do now, each linking to where it is done (not statistics). */
export async function MyDay({ role }: { role: string }) {
  let r: any = null;
  try {
    await ensureOps();
    const rules = await labRules();
    r = await queryOne<any>(
      `select (select count(*)::int from test_orders where status = 'pending') as waiting,
              (select count(*)::int from test_orders where status = 'in_progress') as working,
              (select count(*)::int from test_orders where status in ('pending', 'in_progress') and $1 > 0
                  and created_at < now() - make_interval(mins => $1)) as late,
              (select count(*)::int from critical_alerts where ack_at is null) as critical,
              (select count(*)::int from test_orders where status = 'completed') as ready,
              (select count(*)::int from test_orders where source = 'collect' and created_at >= date_trunc('day', now())) as collected,
              (select count(*)::int from invoices where status in ('unpaid', 'partial') and total - paid > 0) as debts,
              (select coalesce(sum(jsonb_array_length(levels)), 0)::int from qc_analytes where active) as qc_total,
              (select count(*)::int from qc_results where run_date = current_date) as qc_done,
              (select count(*)::int * 2 from temp_units) - (select count(*)::int from temp_readings where read_date = current_date) as temps_missing,
              (select count(*)::int from device_logs where type = 'fault' and not resolved) as faults`,
      [rules.tat]
    );
  } catch {
    return null;
  }
  if (!r) return null;
  const lab = role === "admin" || role === "technician";
  const desk = role === "admin" || role === "reception";
  const items: [string, string, number | string, boolean][] = [];
  if (lab) {
    items.push(["/lab", "عيّنات بانتظار المختبر", r.waiting, r.waiting > 0]);
    items.push(["/lab", "قيد العمل", r.working, false]);
    if (r.late) items.push(["/lab", "عيّنات متأخرة", r.late, true]);
    if (r.critical) items.push(["/lab", "قيم حرجة لم يُبلَّغ عنها", r.critical, true]);
    if (r.qc_total) items.push(["/quality", "مستويات السيطرة اليوم", `${r.qc_done}/${r.qc_total}`, r.qc_done < r.qc_total]);
    if (r.temps_missing > 0) items.push(["/quality", "قراءات حرارة اليوم الناقصة", r.temps_missing, true]);
    if (r.faults) items.push(["/quality", "أعطال أجهزة مفتوحة", r.faults, true]);
  }
  if (desk) {
    items.push(["/collect", "عيّنات ساحب الدم اليوم", r.collected, false]);
    items.push(["/collect", "نتائج جاهزة للتسليم", r.ready, r.ready > 0]);
    if (r.debts) items.push(["/debts", "فواتير لم تُسدَّد", r.debts, false]);
  }
  if (!items.length) return null;
  return (
    <div className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]" data-testid="my-day">
      <div className="mb-2 text-sm font-bold">يومي</div>
      <div className="flex flex-wrap gap-2">
        {items.map(([href, label, n, hot], i) => (
          <Link key={i} href={href} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-canvas ${hot ? "border-amber-300 bg-amber-50" : "border-line"}`}>
            <b className="tabular-nums">{n}</b> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
