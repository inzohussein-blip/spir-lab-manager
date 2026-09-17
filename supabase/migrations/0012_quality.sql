-- 0012_quality.sql — internal quality control runs (Spir-Margin quality → lab QC).

create table if not exists qc_runs (
  id            uuid primary key default gen_random_uuid(),
  control_name  text not null,   -- اسم المحلول الضابط (Level 1/2…)
  analyte       text,            -- التحليل
  target        numeric,         -- القيمة المستهدفة
  measured      numeric,         -- القيمة المقاسة
  tolerance     numeric not null default 10,  -- نسبة السماح %
  unit          text,
  status        text not null default 'pass'
                  check (status in ('pass', 'warn', 'fail')),
  operator      text,
  notes         text,
  run_at        timestamptz not null default now()
);

create index if not exists idx_qc_run_at on qc_runs (run_at desc);
