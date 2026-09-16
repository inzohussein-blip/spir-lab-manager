-- 0009_billing.sql — patient invoicing & payments (Spir-Margin selling → lab).
-- An invoice is raised from a test order; its lines are the ordered tests.

create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    text unique,
  order_id      uuid references test_orders (id) on delete set null,
  patient_id    uuid references patients (id) on delete set null,
  invoice_date  date not null default current_date,
  subtotal      numeric not null default 0,
  discount      numeric not null default 0,   -- absolute amount
  tax_rate      numeric not null default 0,    -- percent (e.g. 15 for VAT)
  tax_amount    numeric not null default 0,
  total         numeric not null default 0,
  paid          numeric not null default 0,
  status        text not null default 'unpaid'
                  check (status in ('unpaid', 'partial', 'paid', 'void')),
  notes         text,
  created_by    uuid references app_users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_invoices_status on invoices (status);
create index if not exists idx_invoices_patient on invoices (patient_id);
create index if not exists idx_invoices_date on invoices (invoice_date);

create table if not exists invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices (id) on delete cascade,
  description  text not null,
  quantity     numeric not null default 1,
  unit_price   numeric not null default 0,
  amount       numeric not null default 0
);

create index if not exists idx_invoice_items_invoice on invoice_items (invoice_id);

create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices (id) on delete cascade,
  amount       numeric not null default 0,
  method       text,   -- 'cash' | 'card' | 'transfer'
  paid_at      timestamptz not null default now(),
  created_by   uuid references app_users (id) on delete set null
);

create index if not exists idx_payments_invoice on payments (invoice_id);
