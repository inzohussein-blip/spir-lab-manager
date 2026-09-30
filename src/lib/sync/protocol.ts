/**
 * Lab database sync — what the stations and the lab's own database exchange.
 *
 * Every device keeps working on its own copy (IndexedDB, no internet needed). When the lab has a
 * database of its own, each device sends what it changed and receives what the other devices
 * changed, one record at a time (a visit, a patient, a test…). When two devices changed the same
 * record, the later change wins. Only text travels: images kept in a record (a data URL, such as
 * an uploaded logo) stay on the device that has them.
 *
 * The database is the lab's, not the site's: Supabase (the device talks to it directly with the
 * project's URL, anon key and a user of the lab), or any PostgreSQL (through this site's server,
 * with a connection string kept encrypted on the server — the device never sees it).
 */

/**
 * Off by default: the lab's database belongs to the full admin panel (lib/db/lab.ts), and the
 * stations stay on the device only. NEXT_PUBLIC_STATION_SYNC=1 at build time switches the
 * stations' sync back on (its window in the stations' settings and in /licenses).
 */
export const STATION_SYNC = process.env.NEXT_PUBLIC_STATION_SYNC === "1";

/** «المزامنة التلقائية» of the lab's computers (switched on per computer in «محطة المزامنة»):
 *  through the site's server into the lab's own place, for devices activated with its code. */
export const COMPANY_SYNC_KEY = "lab-company-sync";
/** Stations this computer keeps to itself (not synced, by network or by file): data prefixes,
 *  chosen in «محطة المزامنة ← الإعدادات». */
export const SYNC_EXCLUDE_KEY = "lab-sync-exclude";
export const SYNC_STATIONS: [string, string][] = [
  ["station.", "محطة المختبر"], ["purchasing.", "المخزن والمشتريات"], ["training.", "التدريب والمعلومات"],
  ["qc.", "الجودة والأجهزة"], ["roster.", "الكادر والدوام"],
];
export function syncExcluded(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SYNC_EXCLUDE_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
/** A station data key this computer shares with the lab's others (not a kept-to-itself station). */
export const sharedStation = (k: string) => !syncExcluded().some((p) => k.startsWith(p));
export function companySyncOn(): boolean {
  try { return localStorage.getItem(COMPANY_SYNC_KEY) === "1"; } catch { return false; }
}

/** One record as stored in the lab's database (table lab_sync_records). */
export interface SyncRow {
  /** The station data key the record belongs to (e.g. "station.visits.v1"). */
  coll: string;
  /** The record's id; "_" for a value that is not a list of records (settings…). */
  id: string;
  /** The record itself (null once deleted). */
  data: unknown;
  /** When the device changed it (ms) — the later change wins. */
  mtime: number;
  deleted: boolean;
  /** Its position in the list, so a new record lands where the other device put it. */
  ord: number;
  /** Increases with every write; devices ask for what changed after the last one they saw. */
  rev?: number;
}

export type SupabaseConfig = { kind: "supabase"; url: string; anonKey: string; email: string; password: string };
export type PostgresConfig = { kind: "postgres"; conn: string };
export type SyncConfig = SupabaseConfig | PostgresConfig;

/** What a device receives about its lab's database with its license (a PostgreSQL connection
 *  string never leaves the server). */
export type DeviceSync = SupabaseConfig | { kind: "postgres"; host: string };

export const SYNC_TABLE = "lab_sync_records";
export const PULL_LIMIT = 500;
export const PUSH_LIMIT = 200;
/** Byte budgets per request (large records such as pictures): what one push sends, one pull returns. */
export const PUSH_BYTES = 1_500_000;
export const PULL_BYTES = 3_000_000;

/** How long a deletion is kept in the lab's database, so every device learns of it (the 180 in SCHEMA_SQL). */
export const TOMBSTONE_DAYS = 180;

/** Table + write function, shared by both kinds of database. */
export const SCHEMA_SQL = `create sequence if not exists lab_sync_rev;
create table if not exists lab_sync_records (
  coll text not null,
  id text not null,
  data jsonb,
  mtime bigint not null,
  deleted boolean not null default false,
  ord integer not null default 0,
  node text not null default '',
  rev bigint not null default nextval('lab_sync_rev'),
  primary key (coll, id)
);
create index if not exists lab_sync_records_rev on lab_sync_records (rev);
create index if not exists lab_sync_records_gone on lab_sync_records (mtime) where deleted;

-- Writes a batch; a record is replaced only by a change at least as recent as the stored one.
-- Also removes deletion marks older than 180 days (only those: records in use are never touched).
create or replace function lab_sync_push(batch jsonb) returns integer
language sql security definer set search_path = public as $$
  delete from lab_sync_records
   where deleted and mtime < (extract(epoch from now()) * 1000)::bigint - 180::bigint * 86400000;
  with up as (
    insert into lab_sync_records as t (coll, id, data, mtime, deleted, ord, node)
    select x.coll, x.id, x.data, x.mtime, coalesce(x.deleted, false), coalesce(x.ord, 0), coalesce(x.node, '')
    from jsonb_to_recordset(batch) as x(coll text, id text, data jsonb, mtime bigint, deleted boolean, ord integer, node text)
    on conflict (coll, id) do update
      set data = excluded.data, mtime = excluded.mtime, deleted = excluded.deleted, ord = excluded.ord,
          node = excluded.node, rev = nextval('lab_sync_rev')
      where excluded.mtime >= t.mtime
    returning 1
  )
  select count(*)::integer from up;
$$;`;

/** Run once in the lab's Supabase project (SQL Editor). Only signed-in users of the project
 *  (Authentication → Users) can read or write; the anon key alone opens nothing. */
export const SUPABASE_SQL = `${SCHEMA_SQL}

alter table lab_sync_records enable row level security;
drop policy if exists "lab users read" on lab_sync_records;
create policy "lab users read" on lab_sync_records for select to authenticated using (true);
revoke all on lab_sync_records from anon;
grant select on lab_sync_records to authenticated;
revoke all on function lab_sync_push(jsonb) from public;
revoke all on function lab_sync_push(jsonb) from anon;
grant execute on function lab_sync_push(jsonb) to authenticated;`;

/** "db.xxxx.supabase.co:5432" from a connection string (for display; never the password). */
export function connHost(conn: string): string {
  try {
    const u = new URL(conn);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname && u.pathname !== "/" ? u.pathname : ""}`;
  } catch {
    return "";
  }
}
export const isPostgresUrl = (s: string) => /^postgres(ql)?:\/\/[^\s]+$/.test(s.trim());
export const isSupabaseUrl = (s: string) => /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(s.trim()) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(s.trim());
