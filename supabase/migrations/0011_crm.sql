-- 0011_crm.sql — referring doctors/clinics + patient appointments
-- (Spir-Margin CRM → lab front office).

create table if not exists referrers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,        -- الطبيب المُحيل
  clinic      text,                 -- العيادة/المستشفى
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Orders can record who referred the patient.
alter table test_orders add column if not exists referrer_id uuid references referrers (id) on delete set null;

create table if not exists appointments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references patients (id) on delete set null,
  patient_name  text,               -- walk-in name when no patient record yet
  referrer_id   uuid references referrers (id) on delete set null,
  scheduled_at  timestamptz not null,
  purpose       text,
  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'done', 'cancelled')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_appt_time on appointments (scheduled_at);
create index if not exists idx_appt_status on appointments (status);
