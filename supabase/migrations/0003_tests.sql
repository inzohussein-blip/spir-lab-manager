-- 0003_tests.sql — test catalogue, orders (visits), and results (section 1)

-- ── Test catalogue ──────────────────────────────────────────────────────────
-- Each test carries its normal range (for H/L auto-flagging) and an optional
-- link to the reagent it consumes (for automatic stock deduction, section 3).
create table if not exists test_catalog (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique,
  name_ar               text not null,
  name_en               text,
  category              text,               -- e.g. Hematology, Biochemistry, Urine
  sample_type           text,               -- Blood / Urine / Stool ...
  unit                  text,               -- mg/dL, g/dL ...
  normal_low            numeric,            -- النطاق الطبيعي (أدنى)
  normal_high           numeric,            -- النطاق الطبيعي (أعلى)
  normal_text           text,              -- for qualitative tests
  price                 numeric not null default 0,
  reagent_product_id    uuid references products (id) on delete set null,
  reagent_qty_per_test  numeric not null default 1,
  is_special            boolean not null default false,  -- Urine/Stool style panels
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ── Test orders (a patient visit) ───────────────────────────────────────────
create table if not exists test_orders (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients (id) on delete cascade,
  order_date    date not null default current_date,
  status        text not null default 'pending'
                  check (status in ('pending', 'in_progress', 'completed', 'delivered')),
  total_amount  numeric not null default 0,
  notes         text,
  created_by    uuid references app_users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_orders_patient on test_orders (patient_id);
create index if not exists idx_orders_date on test_orders (order_date);

create table if not exists test_order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references test_orders (id) on delete cascade,
  test_id       uuid not null references test_catalog (id) on delete restrict,
  price         numeric not null default 0
);

create index if not exists idx_order_items_order on test_order_items (order_id);

-- ── Test results ────────────────────────────────────────────────────────────
-- flag is auto-computed (H/L/N) in 0006 relative to the catalogue normal range.
-- Special panels (Urine/Stool) store physical + microscopic findings as JSON.
create table if not exists test_results (
  id                  uuid primary key default gen_random_uuid(),
  order_item_id       uuid not null references test_order_items (id) on delete cascade,
  order_id            uuid not null references test_orders (id) on delete cascade,
  patient_id          uuid not null references patients (id) on delete cascade,
  test_id             uuid not null references test_catalog (id) on delete restrict,
  value_numeric       numeric,
  value_text          text,
  flag                text check (flag in ('H', 'L', 'N')),  -- مرتفع/منخفض/طبيعي
  physical_inspection jsonb,   -- {color, appearance, sediment}  الفحص العيني
  microscopic         jsonb,   -- {rbc, pus_cells, epithelial, crystals, mucus} المجهري
  verified_by         uuid references app_users (id) on delete set null,
  result_date         timestamptz not null default now()
);

create index if not exists idx_results_order on test_results (order_id);
create index if not exists idx_results_patient on test_results (patient_id);
