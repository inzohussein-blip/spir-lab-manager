import "server-only";
import { queryOne } from "@/lib/db";
import { ensureOps } from "./schema";

/** Counts beside the side menu's items: what is waiting there now (never fails the page). */
export async function navBadges(role: string): Promise<Record<string, { n: number; urgent?: boolean }>> {
  if (role === "collector") {
    const r = await queryOne<{ ready: number }>(
      `select count(*)::int as ready from test_orders where source = 'collect' and status = 'completed' and created_at >= now() - interval '7 days'`
    ).catch(() => null);
    return r?.ready ? { "/collect": { n: r.ready } } : {};
  }
  try {
    await ensureOps();
    const r = await queryOne<any>(
      `select (select count(*)::int from test_orders where status in ('pending', 'in_progress')) as lab,
              (select count(*)::int from critical_alerts where ack_at is null) as critical,
              (select count(*)::int from test_orders where source = 'collect' and status = 'completed') as ready,
              (select count(*)::int from products where is_active and quantity <= min_quantity) as low,
              (select count(*)::int from device_logs where type = 'fault' and not resolved) as faults`
    );
    const out: Record<string, { n: number; urgent?: boolean }> = {};
    if (r?.lab) out["/lab"] = { n: r.lab, urgent: r.critical > 0 };
    if (r?.ready) out["/collect"] = { n: r.ready };
    if (r?.low) out["/inventory"] = { n: r.low, urgent: true };
    if (r?.faults) out["/quality"] = { n: r.faults, urgent: true };
    return out;
  } catch {
    return {};
  }
}
