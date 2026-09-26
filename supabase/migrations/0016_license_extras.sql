-- 0016_license_extras.sql — code manager additions: payment bookkeeping, a message shown on
-- the lab's stations, the owner's name for the device, trial codes, and each code's history.
-- The app also applies these on first use, so existing databases need no manual step.

alter table station_licenses add column if not exists price       text    not null default '';
alter table station_licenses add column if not exists paid        boolean not null default false;
alter table station_licenses add column if not exists paid_at     bigint;
alter table station_licenses add column if not exists message     text    not null default '';
alter table station_licenses add column if not exists device_name text    not null default '';
alter table station_licenses add column if not exists is_trial    boolean not null default false;

create table if not exists license_events (
  id         text primary key,
  license_id text   not null,
  at         bigint not null,   -- ms since epoch
  kind       text   not null,   -- created, activated, moved, extended, stopped, resumed, device_reset, modules, renamed, paid, unpaid, message, new_code
  detail     text   not null default ''
);
create index if not exists license_events_license on license_events (license_id, at desc);
