-- 0001_core.sql — extensions, users, patients, staff
-- Compatible with both PGlite (embedded) and hosted Postgres (Supabase).

create extension if not exists pgcrypto;

-- ── App users (staff login) ─────────────────────────────────────────────────
-- Shares AUTH_SECRET with Spir-Margin for single sign-on, but keeps its own
-- account table so the lab app runs standalone on PGlite too.
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  full_name     text not null,
  role          text not null default 'technician'
                  check (role in ('admin', 'technician', 'reception')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Patients (section 1) ────────────────────────────────────────────────────
create table if not exists patients (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  gender            text check (gender in ('male', 'female')),
  birth_date        date,
  age_years         integer,               -- optional manual age when DOB unknown
  phone             text,
  chronic_diseases  text,                  -- أمراض مزمنة
  current_meds      text,                  -- أدوية حالية
  is_pregnant       boolean not null default false,  -- حالة الحمل
  notes             text,                  -- ملاحظات طبية
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_patients_name on patients (full_name);
create index if not exists idx_patients_phone on patients (phone);

-- ── Staff (section 6) ───────────────────────────────────────────────────────
create table if not exists staff (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  role        text,                        -- الدور الوظيفي
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
