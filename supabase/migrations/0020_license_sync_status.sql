-- Lab codes: what each device last reported about its sync with the lab's database.
alter table station_licenses add column if not exists sync_last_at bigint;
alter table station_licenses add column if not exists sync_pending integer not null default 0;
alter table station_licenses add column if not exists sync_error text not null default '';
alter table station_licenses add column if not exists sync_reported_at bigint;
