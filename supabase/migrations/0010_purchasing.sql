-- 0010_purchasing.sql — purchase-order lifecycle (draft → received).
-- Builds on 0002's purchase_orders / purchase_order_items / suppliers.

alter table purchase_orders add column if not exists status text not null default 'draft'
  check (status in ('draft', 'ordered', 'received', 'cancelled'));
alter table purchase_orders add column if not exists received_at timestamptz;
alter table purchase_orders add column if not exists reference text;
