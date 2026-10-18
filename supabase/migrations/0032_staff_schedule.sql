-- «جدول المناوبات الأسبوعي» (الكادر والبدلاء): the shifts the lab works (name and hours) and each
-- person's shift on each day of the week, repeated every week. Every statement is idempotent.

create table if not exists shift_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_time  time,
  end_time    time,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- One cell per person and weekday (0 = Sunday … 6 = Saturday, as in JavaScript): a shift, or a day off.
create table if not exists staff_schedule (
  staff_id  uuid not null references staff(id) on delete cascade,
  weekday   smallint not null check (weekday between 0 and 6),
  shift_id  uuid references shift_types(id) on delete cascade,
  is_off    boolean not null default false,
  primary key (staff_id, weekday)
);

-- The usual three shifts, once (a lab renames, changes or removes them on the page).
insert into shift_types (name, start_time, end_time, sort)
select v.name, v.s::time, v.e::time, v.sort
  from (values ('صباحي', '08:00', '14:00', 1), ('مسائي', '14:00', '20:00', 2), ('ليلي', '20:00', '08:00', 3)) as v(name, s, e, sort)
 where not exists (select 1 from shift_types);
