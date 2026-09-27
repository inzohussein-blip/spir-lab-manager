-- Lab codes: the full admin panel's own database (sealed with AUTH_SECRET) and a short summary.
alter table station_licenses add column if not exists admin_db text not null default '';
alter table station_licenses add column if not exists admin_db_info text not null default '';
