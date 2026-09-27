import { NextResponse, type NextRequest } from "next/server";
import { licensingEnabled, deviceLicense, getSyncConfig, setSyncConfig, cleanSyncConfig } from "@/lib/license/server";
import { LabDbError, probe, pull, push, lastRev } from "@/lib/sync/pg";
import type { SyncRow } from "@/lib/sync/protocol";

/**
 * A station's way to its lab's PostgreSQL (the connection string stays here, sealed): send the
 * records it changed, receive what the lab's other devices changed. Only a device holding the
 * lab's code (bound to it, running, in date) is served.
 */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "cache-control": "no-store" } });
const dbError = (e: unknown) =>
  e instanceof LabDbError ? json({ ok: false, error: e.code }, 502) : json({ ok: false, error: "db" }, 502);

export async function POST(req: NextRequest) {
  if (!licensingEnabled()) return json({ ok: false, error: "disabled" }, 400);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const lid = String(b.lid ?? ""), device = String(b.device ?? "");
  if (!lid || !/^[\w-]{8,80}$/.test(device)) return json({ ok: false, error: "bad_request" }, 400);
  const lic = await deviceLicense(lid, device);
  if (!lic.ok) return json({ ok: false, error: lic.error }, 403);
  const cur = await getSyncConfig(lid);

  // The lab links (or unlinks) its own PostgreSQL from the station's settings.
  if (b.op === "config") {
    if (cur && cur.by === "owner") return json({ ok: false, error: "owner_set" }, 409);
    if (b.config == null) { await setSyncConfig(lid, null, "device"); return json({ ok: true }); }
    const cfg = cleanSyncConfig(b.config);
    if (!cfg || cfg.kind !== "postgres") return json({ ok: false, error: "bad_config" }, 400);
    let records = 0;
    try { records = (await probe(cfg.conn)).records; } catch (e) { return dbError(e); }
    const err = await setSyncConfig(lid, cfg, "device");
    if (err) return json({ ok: false, error: err }, 400);
    return json({ ok: true, records });
  }

  if (!cur || cur.cfg.kind !== "postgres") return json({ ok: false, error: "no_db" }, 409);
  const conn = cur.cfg.conn;
  const node = String(b.node ?? "").slice(0, 80);
  try {
    if (b.op === "probe") return json({ ok: true, ...(await probe(conn)), rev: await lastRev(conn) });
    if (b.op === "pull") return json({ ok: true, rows: await pull(conn, Number(b.since) || 0, node, Number(b.limit) || undefined) });
    if (b.op === "push") {
      if (!node || !Array.isArray(b.rows)) return json({ ok: false, error: "bad_request" }, 400);
      return json({ ok: true, written: await push(conn, b.rows as SyncRow[], node) });
    }
  } catch (e) { return dbError(e); }
  return json({ ok: false, error: "bad_request" }, 400);
}
