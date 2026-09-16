-- 0002_inventory.sql — reagents/kits inventory, suppliers, orders, expenses
-- Mirrors Spir-Margin naming (products / stock_movements) so the shared DB can
-- reuse one physical inventory across both apps.

-- ── Suppliers (section 4) ───────────────────────────────────────────────────
create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Products = reagents / kits (section 3) ──────────────────────────────────
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,          -- اسم المادة (Reagent/Kit)
  unit              text not null default 'test',
  quantity          numeric not null default 0,   -- الكمية المتوفرة
  min_quantity      numeric not null default 7,    -- الحد الأدنى للتنبيه
  expiry_date       date,                   -- تاريخ الانتهاء
  buy_price         numeric not null default 0,
  supplier_id       uuid references suppliers (id) on delete set null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_products_name on products (name);

-- ── Stock movements (ledger) ────────────────────────────────────────────────
create table if not exists stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products (id) on delete cascade,
  change_qty    numeric not null,           -- +receive / -consume
  reason        text not null,              -- 'test', 'purchase', 'adjustment', 'expiry'
  ref_table     text,
  ref_id        uuid,
  created_at    timestamptz not null default now()
);

create index if not exists idx_stock_moves_product on stock_movements (product_id);

-- ── Purchase orders (section 4) ─────────────────────────────────────────────
create table if not exists purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references suppliers (id) on delete set null,
  order_date    date not null default current_date,
  total_amount  numeric not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references purchase_orders (id) on delete cascade,
  product_id    uuid references products (id) on delete set null,
  description   text,
  quantity      numeric not null default 1,
  unit_price    numeric not null default 0
);

-- ── Expenses (section 4) ────────────────────────────────────────────────────
create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  amount        numeric not null default 0,
  spent_on      date not null default current_date,
  category      text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_expenses_date on expenses (spent_on);
