-- 0006_views_functions.sql — auto H/L flagging, auto stock deduction, and
-- dashboard views.

-- ── Auto H/L/N flag for numeric results (section 1) ─────────────────────────
create or replace function compute_result_flag() returns trigger as $$
declare
  lo numeric;
  hi numeric;
begin
  if new.value_numeric is null then
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

drop trigger if exists trg_result_flag on test_results;
create trigger trg_result_flag
  before insert or update on test_results
  for each row execute function compute_result_flag();

-- ── Auto reagent deduction when a test is added to an order (section 3) ──────
create or replace function deduct_reagent_on_test() returns trigger as $$
declare
  rp uuid;
  qty numeric;
begin
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

drop trigger if exists trg_deduct_reagent on test_order_items;
create trigger trg_deduct_reagent
  after insert on test_order_items
  for each row execute function deduct_reagent_on_test();

-- ── Dashboard / alert views ─────────────────────────────────────────────────
create or replace view v_low_stock as
  select id, name, quantity, min_quantity, expiry_date
    from products
   where is_active and quantity <= min_quantity;

create or replace view v_expiring_reagents as
  select id, name, quantity, expiry_date
    from products
   where is_active and expiry_date is not null
     and expiry_date <= current_date + interval '30 days';

-- ملخص يومي: عدد المراجعين والدخل لكل يوم
create or replace view v_daily_summary as
  select order_date,
         count(*)              as visits,
         coalesce(sum(total_amount), 0) as income
    from test_orders
   group by order_date;
