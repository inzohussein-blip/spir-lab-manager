import "server-only";
import { createHash } from "node:crypto";
import { storeOf, targetForCode, type Where } from "@/lib/db/lab";
import { SCHEMA_SQL } from "./protocol";
import { LabDbError, type Queryable } from "./pg";

/**
 * The lab's own sync («محطة المزامنة»): its computers exchange station records through the lab's
 * own place (lib/db/lab.ts): its own database, or its section of the site's (trial codes, or while
 * the owner does not require a database of its own). The place comes from the lab code of the
 * device's signed license (never from what a device sends), so one lab's records never reach
 * another lab's computers.
 */

const g = globalThis as unknown as { __companySyncReady?: Map<string, Promise<void>> };
const ready = (g.__companySyncReady ??= new Map());

/** A short name for where the lab's records live: a device that finds it changed joins again. */
export const placeId = (w: Where) => createHash("sha256").update("conn" in w ? `own:${w.conn}` : `site:${w.schema}`).digest("hex").slice(0, 16);

/** The records table in the lab's place (its write function looks only in that section). */
export async function companyPlace(lid: string): Promise<{ q: Queryable; place: string }> {
  const t = await targetForCode(lid);
  if (!t.where) throw new LabDbError("needs_db", "the lab has no database of its own yet");
  const w = t.where;
  const store = await storeOf(w);
  const key = placeId(w);
  let p = ready.get(key);
  if (!p) {
    const sql = "schema" in w ? SCHEMA_SQL.replace("set search_path = public", `set search_path = "${w.schema}"`) : SCHEMA_SQL;
    p = store.tx((c) => c.exec(sql));
    p.catch(() => ready.delete(key));
    ready.set(key, p);
  }
  await p;
  return { q: store, place: key };
}

/** The local network hub's records: on the lab's own computer, in its own database. */
export async function hubPlace(): Promise<{ q: Queryable; place: string }> {
  const w: Where = { schema: "public" };
  const store = await storeOf(w);
  let p = ready.get("hub");
  if (!p) {
    p = store.tx((c) => c.exec(SCHEMA_SQL));
    p.catch(() => ready.delete("hub"));
    ready.set("hub", p);
  }
  await p;
  return { q: store, place: "hub" };
}
