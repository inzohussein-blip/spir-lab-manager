-- 0026_finance.sql — «الحسابات»: the daily cash box closing and referring doctors' shares.

-- One closing per day: the cash counted in the drawer against what the day's records expect.
create table if not exists cash_closings (
  day          date primary key,
  expected     numeric not null default 0,   -- cash in − cash out, by the records
  counted      numeric not null default 0,   -- counted in the drawer
  notes        text,
  closed_by    uuid references app_users (id) on delete set null,
  closed_at    timestamptz not null default now()
);

-- A referring doctor's share of what their referrals were billed (percent, 0 = none).
alter table referrers add column if not exists commission_pct numeric not null default 0;

create index if not exists idx_payments_paid_at on payments (paid_at);
create index if not exists idx_expenses_spent_on on expenses (spent_on);
create index if not exists idx_orders_referrer on test_orders (referrer_id);
