-- Lab codes: several devices per code, self-registration and the error log (all off by default in
-- the owner's settings). Also created on first use by src/lib/license/server.ts.
alter table station_licenses add column if not exists max_devices integer not null default 1;
alter table station_licenses add column if not exists source text not null default '';
create table if not exists license_devices (
  license_id text not null, device_id text not null, label text not null default '', activated_at bigint not null,
  last_seen_at bigint, app_version text not null default '', primary key (license_id, device_id));
create table if not exists license_errors (
  id text primary key, at bigint not null, license_id text, kind text not null default '', path text not null default '',
  message text not null default '', digest text not null default '', agent text not null default '');
create index if not exists license_errors_at on license_errors (at desc);
