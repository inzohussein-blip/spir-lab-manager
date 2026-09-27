-- Lab codes: the last check of the full admin panel's own database (shown in «قواعد البيانات»).
alter table station_licenses add column if not exists admin_db_check_at bigint;
alter table station_licenses add column if not exists admin_db_ok boolean;
alter table station_licenses add column if not exists admin_db_error text not null default '';
