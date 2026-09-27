-- Lab codes: the lab's own database (sealed with AUTH_SECRET) and a short summary for the list.
alter table station_licenses add column if not exists sync_config text not null default '';
alter table station_licenses add column if not exists sync_info text not null default '';
