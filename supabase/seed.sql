-- seed.sql — sample data for local (PGlite) development.
-- Passwords are bcrypt-hashed via pgcrypto so the same hash verifies on
-- PGlite and hosted Postgres. Default login:  admin / admin123

insert into app_users (username, password_hash, full_name, role)
  values ('admin', crypt('admin123', gen_salt('bf')), 'مدير المختبر', 'admin')
  on conflict (username) do nothing;

-- ── Suppliers & reagents (inventory) ────────────────────────────────────────
insert into suppliers (id, name, phone) values
  ('11111111-1111-1111-1111-111111111111', 'شركة الكواشف الطبية', '0500000000')
  on conflict do nothing;

insert into products (id, name, unit, quantity, min_quantity, expiry_date, buy_price, supplier_id) values
  ('22222222-2222-2222-2222-222222222201', 'كاشف الجلوكوز', 'test', 40, 10, current_date + interval '120 days', 0.5, '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222202', 'كاشف CBC', 'test', 6, 7, current_date + interval '20 days', 0.8, '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222203', 'شرائح تحليل البول', 'test', 25, 10, current_date + interval '200 days', 0.3, '11111111-1111-1111-1111-111111111111')
  on conflict do nothing;

-- ── Test catalogue (with normal ranges + reagent links) ─────────────────────
insert into test_catalog (code, name_ar, name_en, category, sample_type, unit, normal_low, normal_high, price, reagent_product_id, reagent_qty_per_test, is_special) values
  ('GLU', 'سكر صائم', 'Fasting Glucose', 'Biochemistry', 'Blood', 'mg/dL', 70, 110, 15, '22222222-2222-2222-2222-222222222201', 1, false),
  ('HGB', 'الهيموغلوبين', 'Hemoglobin', 'Hematology', 'Blood', 'g/dL', 12, 16, 20, '22222222-2222-2222-2222-222222222202', 1, false),
  ('WBC', 'كريات الدم البيضاء', 'WBC Count', 'Hematology', 'Blood', '10^3/uL', 4, 11, 20, '22222222-2222-2222-2222-222222222202', 1, false),
  ('URINE', 'تحليل البول العام', 'Urine Analysis', 'Urine', 'Urine', null, null, null, 25, '22222222-2222-2222-2222-222222222203', 1, true)
  on conflict (code) do nothing;

-- ── Staff ───────────────────────────────────────────────────────────────────
insert into staff (full_name, role, phone) values
  ('أحمد الفني', 'فني مختبر', '0511111111'),
  ('سارة الاستقبال', 'موظفة استقبال', '0522222222')
  on conflict do nothing;

-- ── Sample patients ─────────────────────────────────────────────────────────
insert into patients (id, full_name, gender, age_years, phone, chronic_diseases) values
  ('33333333-3333-3333-3333-333333333301', 'محمد عبدالله السالم', 'male', 45, '0530000001', 'سكري'),
  ('33333333-3333-3333-3333-333333333302', 'فاطمة أحمد الزهراني', 'female', 32, '0530000002', null)
  on conflict do nothing;

-- ── In-complex referring doctors (reception "طبيب من المجمع") ────────────────
insert into referrers (id, name, clinic, phone) values
  ('44444444-4444-4444-4444-444444444401', 'د. سارية حسين', 'باطنية', '0540000001'),
  ('44444444-4444-4444-4444-444444444402', 'د. خالد يوسف', 'جراحة', '0540000002'),
  ('44444444-4444-4444-4444-444444444403', 'د. ليلى كمال', 'أطفال', '0540000003'),
  ('44444444-4444-4444-4444-444444444404', 'د. عمر فاروق', 'أسنان', '0540000004')
  on conflict (id) do nothing;
