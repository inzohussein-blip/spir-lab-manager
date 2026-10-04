-- «نافذة ساحب الدم» و«نافذة المختبر» ومسار العمل:
--  • دور جديد «ساحب الدم» (collector): يسجّل المراجع وفحوصاته بأسعارها ويعطيه الوصل؛
--  • من أين جاء الطلب (source: desk = الاستقبال، collect = ساحب الدم، lab = المختبر مباشرة بلا أسعار)؛
--  • أوقات المراحل (استلام ← قيد العمل ← اعتماد ← تسليم) واعتماد ثانٍ اختياري؛
--  • النطاق الطبيعي بشكل المحطة (حسب الجنس والعمر) والقيم الحرجة لكل فحص، وتمييز النتيجة؛
--  • سجل القيم الحرجة وإقرار من أُبلغ بها.
-- Idempotent: also applied on first use to the site's own database by src/lib/desk/schema.ts.

alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check check (role in ('admin', 'technician', 'reception', 'collector'));

alter table test_orders add column if not exists source text not null default 'desk';
alter table test_orders add column if not exists discount numeric(12,2) not null default 0;
alter table test_orders add column if not exists started_at timestamptz;
alter table test_orders add column if not exists completed_at timestamptz;
alter table test_orders add column if not exists delivered_at timestamptz;
alter table test_orders add column if not exists verified_by uuid;
alter table test_orders add column if not exists verified2_by uuid;
alter table test_orders add column if not exists verified2_at timestamptz;
create index if not exists test_orders_status_created on test_orders (status, created_at desc);

alter table test_catalog add column if not exists normal jsonb;
alter table test_catalog add column if not exists critical_low numeric;
alter table test_catalog add column if not exists critical_high numeric;
alter table test_catalog add column if not exists tat_minutes int;

alter table test_results add column if not exists hl boolean not null default false;
alter table test_results add column if not exists critical boolean not null default false;

create table if not exists critical_alerts (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references test_orders(id) on delete cascade,
  test_id    uuid references test_catalog(id) on delete set null,
  test_name  text not null,
  value      text not null,
  created_at timestamptz not null default now(),
  ack_by     uuid,
  ack_name   text,
  ack_to     text,
  ack_at     timestamptz
);
create index if not exists critical_alerts_open on critical_alerts (ack_at, created_at desc);
create index if not exists critical_alerts_order on critical_alerts (order_id);

-- The flag the app worked out (sex and age ranges, qualitative answers) is kept; the catalog's
-- plain range only fills it when none was given.
create or replace function compute_result_flag() returns trigger as $$
declare
  lo numeric;
  hi numeric;
begin
  if new.flag is not null or new.value_numeric is null then
    return new;
  end if;
  select normal_low, normal_high into lo, hi
    from test_catalog where id = new.test_id;
  if hi is not null and new.value_numeric > hi then
    new.flag := 'H';
  elsif lo is not null and new.value_numeric < lo then
    new.flag := 'L';
  elsif lo is not null or hi is not null then
    new.flag := 'N';
  end if;
  return new;
end;
$$ language plpgsql;
