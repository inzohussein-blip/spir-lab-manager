-- 0013_order_payment.sql — capture payment at reception, on the order itself.
-- The reception desk records how the visit was paid when the request is raised,
-- so the release desk and daily summary can see it without a full invoice.

alter table test_orders
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'partial')),
  add column if not exists payment_method text
    check (payment_method in ('cash', 'card', 'transfer'));

create index if not exists idx_orders_payment on test_orders (payment_status);
