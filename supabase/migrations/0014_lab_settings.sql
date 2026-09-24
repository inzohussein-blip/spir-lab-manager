-- 0014_lab_settings.sql — letterhead details typed by the lab (no built-in text).
-- Key/value pairs: lab_subtitle (qualification line under the lab name) and
-- lab_footer (address / phone line printed at the bottom of reports and receipts).
-- The app also creates this table on first use, so existing databases need no manual step.

create table if not exists lab_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
