-- 0005_reports_whatsapp.sql — printable reports + QR (section 8) and
-- WhatsApp delivery log (section 5)

-- Each generated A4 report gets a stable public token used to build the QR
-- code that lets a patient/doctor verify the report online.
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references test_orders (id) on delete cascade,
  patient_id   uuid not null references patients (id) on delete cascade,
  qr_token     text not null unique default encode(gen_random_bytes(12), 'hex'),
  generated_at timestamptz not null default now()
);

create index if not exists idx_reports_order on reports (order_id);

create table if not exists whatsapp_log (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid references patients (id) on delete set null,
  order_id     uuid references test_orders (id) on delete set null,
  phone        text not null,
  channel      text not null default 'wa_link'  -- 'wa_link' (MVP) | 'cloud_api'
                 check (channel in ('wa_link', 'cloud_api')),
  status       text not null default 'queued',
  sent_at      timestamptz not null default now()
);
