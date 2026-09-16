-- 0004_shifts.sql — staff shifts & cover shifts (section 6)

create table if not exists shifts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff (id) on delete cascade,
  work_date   date not null,
  start_time  time,
  end_time    time,
  shift_type  text,                         -- morning / evening / night
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_shifts_date on shifts (work_date);

-- سجل البدلاء: توثيق اليوم الذي غطّى فيه موظف مكان آخر
create table if not exists cover_shifts (
  id                  uuid primary key default gen_random_uuid(),
  cover_date          date not null,
  original_staff_id   uuid references staff (id) on delete set null,  -- الموظف الأصلي
  cover_staff_id      uuid references staff (id) on delete set null,  -- البديل
  reason              text,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_cover_date on cover_shifts (cover_date);
