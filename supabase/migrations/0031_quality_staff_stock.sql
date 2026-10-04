-- لوحة الإدارة بمستوى المحطات وأكثر:
--  • الجودة: المحاليل الضابطة بمستوياتها (المتوسط والانحراف)، القيم اليومية (قواعد Westgard ومخطط Levey-Jennings)،
--    سجل درجات الحرارة، الأجهزة (الصيانة الدورية والمعايرة والأعطال)؛
--  • الكادر: الراتب، الحضور والانصراف، الإجازات، السُّلف، ومنها الرواتب الشهرية؛
--  • المخزون: الجرد الكامل بفروقاته، والعبوات (Kit فيها عدد من وحدات مادة).
-- Idempotent: also applied on first use to the site's own database by src/lib/desk/schema.ts.

create table if not exists qc_analytes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  unit       text,
  device     text,
  -- [{ id, label, lot, mean, sd }]
  levels     jsonb not null default '[]',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qc_results (
  id         uuid primary key default gen_random_uuid(),
  analyte_id uuid not null references qc_analytes(id) on delete cascade,
  level_id   text not null,
  run_date   date not null,
  value      numeric not null,
  mean       numeric,
  sd         numeric,
  by_name    text,
  note       text,
  at         timestamptz not null default now(),
  unique (analyte_id, level_id, run_date)
);
create index if not exists qc_results_date on qc_results (run_date);

create table if not exists temp_units (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  kind   text,
  min_c  numeric not null,
  max_c  numeric not null
);

create table if not exists temp_readings (
  id        uuid primary key default gen_random_uuid(),
  unit_id   uuid not null references temp_units(id) on delete cascade,
  read_date date not null,
  slot      text not null check (slot in ('AM', 'PM')),
  value     numeric not null,
  by_name   text,
  action    text,
  unique (unit_id, read_date, slot)
);

create table if not exists lab_devices (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  model        text,
  serial       text,
  calib_months int,
  last_calib   date,
  -- [{ id, name, freq: daily|weekly|monthly|quarterly|yearly, lastDone }]
  tasks        jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

create table if not exists device_logs (
  id        uuid primary key default gen_random_uuid(),
  device_id uuid not null references lab_devices(id) on delete cascade,
  log_date  date not null default current_date,
  type      text not null check (type in ('maintenance', 'fault', 'calibration')),
  text      text not null,
  action    text,
  downtime  numeric,
  resolved  boolean not null default false,
  by_name   text,
  at        timestamptz not null default now()
);
create index if not exists device_logs_device on device_logs (device_id, log_date desc);

alter table staff add column if not exists salary numeric(12,2) not null default 0;

create table if not exists attendance (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references staff(id) on delete cascade,
  work_date date not null,
  check_in  time,
  check_out time,
  status    text not null default 'present' check (status in ('present', 'late', 'absent', 'leave')),
  note      text,
  unique (staff_id, work_date)
);
create index if not exists attendance_date on attendance (work_date);

create table if not exists staff_leaves (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references staff(id) on delete cascade,
  from_date date not null,
  to_date   date not null,
  kind      text not null default 'annual',
  paid      boolean not null default true,
  note      text,
  created_at timestamptz not null default now()
);

create table if not exists staff_advances (
  id       uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  amount   numeric(12,2) not null,
  given_on date not null default current_date,
  note     text
);

create table if not exists stock_counts (
  id         uuid primary key default gen_random_uuid(),
  counted_at timestamptz not null default now(),
  by_name    text,
  note       text,
  items      int not null default 0,
  diffs      int not null default 0
);
create table if not exists stock_count_lines (
  count_id   uuid not null references stock_counts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  expected   numeric not null,
  counted    numeric not null,
  primary key (count_id, product_id)
);

create table if not exists stock_kits (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  product_id uuid not null references products(id) on delete cascade,
  units      numeric not null check (units > 0),
  created_at timestamptz not null default now()
);

-- «نافذة الأطباء» من لوحة الإدارة: رمز لكل طبيب محيل، يحفظه الخادم ليختم به نتائج مراجعيه المعتمدة
-- ويرفعها لنافذة الأطباء (يفتحها الطبيب بالرمز نفسه).
create table if not exists doctor_codes (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references referrers(id) on delete cascade,
  code        text not null,
  tag         text not null unique,
  win         text not null default 'month',
  hide_phone  boolean not null default false,
  created_at  timestamptz not null default now(),
  last_at     timestamptz,
  last_error  text
);

-- «استيراد من المحطات»: the station visit an order came from (imported once).
alter table test_orders add column if not exists station_ref text;
create unique index if not exists test_orders_station_ref on test_orders (station_ref) where station_ref is not null;

-- Reagents are deducted when a test is ordered — not for visits imported from a station (done long ago).
create or replace function deduct_reagent_on_test() returns trigger as $$
declare
  rp uuid;
  qty numeric;
begin
  if exists (select 1 from test_orders where id = new.order_id and station_ref is not null) then
    return new;
  end if;
  select reagent_product_id, reagent_qty_per_test into rp, qty
    from test_catalog where id = new.test_id;
  if rp is not null and qty is not null and qty <> 0 then
    update products set quantity = quantity - qty where id = rp;
    insert into stock_movements (product_id, change_qty, reason, ref_table, ref_id)
      values (rp, -qty, 'test', 'test_order_items', new.id);
  end if;
  return new;
end;
$$ language plpgsql;
