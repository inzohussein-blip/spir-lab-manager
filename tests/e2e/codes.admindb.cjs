// Where each lab's full admin panel keeps its data:
//  • without a database of its own, its own section of the site's database — labs never see each
//    other's records; the old shared data can be brought to the lab that used it;
//  • with «لوحة الإدارة تحتاج قاعدة خاصة» on (the default), a paid code's panel stays closed until
//    a database is linked (trial codes keep their section); the lab can link one itself;
//  • a lab's own PostgreSQL, linked by the owner through each provider's interface (Neon,
//    Supabase, Railway, other), checked, with the admin's password reset and default tests;
//  • a new database or section starts with a first-admin form at the sign-in page.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const { PG, freshDb, waitFor } = require('./pgfake.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.43' };
const TAG = Date.now().toString(36);
const LAB = 'مختبر القاعدة الخاصة ' + TAG;
const LAB2 = 'مختبر الجار ' + TAG;
const LAB_T = 'مختبر تجريبي ' + TAG;
const SAMPLE = 'محمد عبدالله السالم'; // in the site's old shared data (seed)
const ROUTES = ['/', '/appointments', '/audit', '/calendar', '/insights', '/inventory', '/invoices', '/orders', '/orders/new',
  '/orders-expenses', '/patients', '/patients/new', '/purchase-orders', '/quality', '/referrers', '/release', '/reorder', '/settings',
  '/staff', '/stock-balance', '/suppliers', '/tests', '/tools', '/users', '/worklist'];

(async () => {
  if (!PG) { console.log('SKIP codes.admindb.cjs — set E2E_PG_URL'); ok(!process.env.CI, 'E2E_PG_URL is set in CI'); return done(); }
  const db = await freshDb('admindb');
  const db2 = await freshDb('admindb2');
  const db3 = await freshDb('admindb3');
  const db4 = await freshDb('admindb4');
  const pgPass = new URL(PG).password;
  const b = await launch();
  const errs = [];
  const o = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR })).newPage();
  o.on('dialog', (d) => d.accept());
  await o.goto(B + '/licenses');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');

  // ── The owner's general settings ──
  await o.goto(B + '/licenses#settings'); await o.reload(); await o.waitForSelector('[data-testid="prefs-card"]', { timeout: 15000 });
  ok(await o.locator('input[aria-label="سطر التواصل"]').count() === 1, 'settings section: holds the contact line too');
  const prefs = o.locator('[data-testid="prefs-card"]');
  const needsOwn = prefs.locator('input[aria-label="لوحة الإدارة تحتاج قاعدة خاصة"]');
  ok(await needsOwn.isChecked(), '«لوحة الإدارة تحتاج قاعدة خاصة» is on by default');
  await prefs.locator('select[aria-label="مدة الرمز الافتراضية"]').selectOption('90');
  await prefs.locator('input[aria-label="أيام الرمز التجريبي"]').fill('10');
  await prefs.locator('button[aria-pressed]:has-text("لوحة الإدارة الكاملة")').click();
  await needsOwn.uncheck(); // first: every lab in its own section of the site's database
  await prefs.locator('button:has-text("حفظ الإعدادات")').click();
  await waitFor(async () => (await prefs.locator('[data-testid="prefs-msg"]').innerText().catch(() => '')).includes('حُفظت'), 10000);
  await o.goto(B + '/licenses#new'); await o.reload(); await o.waitForSelector('text=إنشاء الرمز', { timeout: 15000 });
  ok(await o.locator('form select').first().inputValue() === '90', 'a new code starts with the default period (3 months)');
  ok(await o.locator('form button[aria-pressed="true"]:has-text("لوحة الإدارة الكاملة")').count() === 1, 'and with the default stations (admin panel on)');
  ok(await o.locator('button:has-text("رمز تجريبي 10")').count() === 1, 'trial length from the settings (10 days)');
  ok(await o.locator('[data-section="contact"]').count() === 0 && await o.locator('[data-section="databases"]').count() === 1, 'side menu: «قواعد البيانات» and «الإعدادات العامة»');

  const c = await api({ op: 'create', lab: LAB, days: 30, modules: ['station', 'admin'] });
  const c2 = await api({ op: 'create', lab: LAB2, days: 30, modules: ['station', 'admin'] });
  const ct = await api({ op: 'create', lab: LAB_T, days: 7, modules: ['station', 'admin'], trial: true });
  ok(!!c.code && !!c2.code && !!ct.code && ct.row.is_trial, 'two paid codes and a trial code with the full admin panel');

  // ── Devices ──
  const device = async (code) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR });
    const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(`${pg.url()} ${e.message.slice(0, 140)}`)); pg.on('dialog', (d) => d.accept());
    await pg.goto(B + '/welcome'); await pg.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
    await pg.fill('input[aria-label="رمز المختبر"]', code); await pg.click('button:has-text("تفعيل")'); await pg.waitForTimeout(1500);
    return { ctx, p: pg };
  };
  // Sign out first (a signed-in device is sent away from the login page).
  const signOut = async (pg) => {
    const keep = (await pg.context().cookies()).filter((x) => x.name !== 'lab_session');
    await pg.context().clearCookies(); await pg.context().addCookies(keep);
  };
  const signInOn = async (pg, user, pass) => {
    await signOut(pg);
    await pg.goto(B + '/login'); await pg.waitForSelector('input[name="username"]', { timeout: 20000 });
    await pg.fill('input[name="username"]', user); await pg.fill('input[name="password"]', pass);
    await pg.click('button[type="submit"]');
    await pg.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
    return !new URL(pg.url()).pathname.startsWith('/login');
  };
  const firstRun = async (pg, user, pass) => {
    await signOut(pg);
    await pg.goto(B + '/login'); await pg.waitForSelector('[data-testid="first-run"]', { timeout: 20000 });
    await pg.fill('input[name="full_name"]', 'مدير ' + user); await pg.fill('input[name="username"]', user);
    await pg.fill('input[name="password"]', pass); await pg.fill('input[name="again"]', pass);
    await pg.click('button[type="submit"]');
    await pg.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
    return !new URL(pg.url()).pathname.startsWith('/login');
  };
  const addPatient = async (pg, name) => {
    await pg.goto(B + '/patients/new');
    await pg.fill('input[name="full_name"]', name); await pg.fill('input[name="age_years"]', '40'); await pg.fill('input[name="phone"]', '07712345678');
    await pg.click('button:has-text("حفظ المريض")'); await pg.waitForTimeout(2500);
  };
  const lists = async (pg, name) => {
    await pg.goto(B + '/patients?q=' + encodeURIComponent(name));
    return (await pg.locator('a[href^="/patients/"]', { hasText: name }).count()) > 0;
  };

  const { ctx, p } = await device(c.code);
  const { p: p2 } = await device(c2.code);
  ok((await ctx.cookies()).some((x) => x.name === 'lab_lic_admin'), 'the device has the admin-panel cookie');

  // ── Each lab in its own section of the site's database ──
  await p.goto(B + '/login');
  ok(await p.locator('[data-testid="first-run"]').count() === 1 && !(await p.content()).includes('admin123'), 'a lab\'s new section: first-admin form (no demo account)');
  ok(await firstRun(p, 'secadmin', 'sec-pass-1'), 'lab 1 creates its first admin and is in');
  ok(!(await lists(p, SAMPLE)), 'lab 1 does not see the site\'s shared data');
  const P1 = 'مريض المختبر الأول ' + TAG;
  await addPatient(p, P1);
  ok(await lists(p, P1), 'lab 1 saves a patient in its section');
  ok(await firstRun(p2, 'nbadmin', 'nb-pass-1'), 'lab 2 creates its own first admin');
  ok(!(await lists(p2, P1)) && !(await lists(p2, SAMPLE)), 'lab 2 sees neither lab 1\'s patients nor the shared data');
  ok(!(await signInOn(p2, 'secadmin', 'sec-pass-1')), 'lab 1\'s account does not open lab 2\'s panel');

  // Old shared data → the lab that used it.
  await o.goto(B + '/licenses#databases'); await o.reload(); await o.waitForSelector('[data-testid="db-list"]', { timeout: 15000 });
  const item = o.locator(`li[data-db-lab="${LAB}"]`);
  ok((await item.locator('[data-testid="db-state"]').innerText()).includes('قسم مستقل في قاعدة الموقع'), 'databases section: lab 1 in its own section of the site\'s database');
  await item.locator('button:has-text("البيانات القديمة")').click();
  ok(((await waitFor(async () => { const t = await item.locator('[data-testid="db-check"]').innerText().catch(() => ''); return t.includes('نُقلت') && t; }, 30000)) || '').length > 0, 'owner: the old shared data moved to lab 1');
  ok(await signInOn(p, 'secadmin', 'sec-pass-1') && await lists(p, SAMPLE) && await lists(p, P1), 'lab 1 now sees the old data beside its own');
  await signInOn(p2, 'nbadmin', 'nb-pass-1');
  ok(!(await lists(p2, SAMPLE)), 'lab 2 still does not');

  // Owner's password reset works in a section too.
  await item.locator('button:has-text("كلمة مرور المدير")').click();
  const rm = o.locator('[data-testid="reset-admin-modal"]');
  await rm.locator('input[aria-label="اسم مستخدم المدير"]').fill('secadmin');
  await rm.locator('input[aria-label="كلمة المرور الجديدة"]').fill('sec-pass-2');
  await rm.locator('input[aria-label="تأكيد كلمة المرور"]').fill('sec-pass-2');
  await rm.locator('button:has-text("حفظ كلمة المرور")').click();
  ok(((await waitFor(() => rm.locator('[data-testid="reset-admin-msg"]').innerText().catch(() => ''), 15000)) || '').includes('تغيّرت كلمة المرور'), 'owner: lab 1\'s admin password changed (in its section)');
  await rm.locator('button:has-text("إغلاق")').click();
  ok(!(await signInOn(p, 'secadmin', 'sec-pass-1')) && await signInOn(p, 'secadmin', 'sec-pass-2'), 'only the new password opens lab 1\'s panel');

  // ── Rule on: a paid code needs a database of its own; a trial code keeps its section ──
  await o.goto(B + '/licenses#settings'); await o.reload(); await o.waitForSelector('[data-testid="prefs-card"]', { timeout: 15000 });
  await needsOwn.check();
  await prefs.locator('button:has-text("حفظ الإعدادات")').click();
  await waitFor(async () => (await prefs.locator('[data-testid="prefs-msg"]').innerText().catch(() => '')).includes('حُفظت'), 10000);
  await p.goto(B + '/'); await p.waitForTimeout(500);
  await p.goto(B + '/login');
  ok(await p.locator('[data-testid="needs-db"]').count() === 1, 'lab 1 (paid, no database): the panel asks for a database of its own');
  const { p: pt } = await device(ct.code);
  ok(await firstRun(pt, 'trialadmin', 'trial-pass-1') && !(await lists(pt, P1)), 'the trial code still works in its own section');
  await o.goto(B + '/licenses#databases'); await o.reload(); await o.waitForSelector('[data-testid="db-list"]', { timeout: 15000 });
  ok((await item.locator('[data-testid="db-state"]').innerText()).includes('بانتظار قاعدة خاصة'), 'databases section: lab 1 «بانتظار قاعدة خاصة»');
  ok(Number(await o.locator('[data-testid="db-waiting-count"]').innerText()) >= 2, 'summary counts the codes waiting for a database');

  // ── Owner links lab 1's own database: one interface per provider ──
  await o.goto(B + '/licenses'); await o.waitForSelector(`div[data-lab="${LAB}"]`, { timeout: 15000 });
  const card = o.locator(`div[data-lab="${LAB}"]`);
  ok(await card.locator('[data-testid="lab-db"]').count() === 0, 'card: no station-sync column (station sync off)');
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('بانتظار قاعدة خاصة'), 'card: waiting for a database');
  await card.locator('button[aria-label="قاعدة لوحة الإدارة"]').click();
  const modal = o.locator('[data-testid="admin-db-modal"]');
  const msg = () => modal.locator('[data-testid="admin-db-msg"]').innerText();
  const conn = modal.locator('input[aria-label="رابط قاعدة لوحة الإدارة"]');
  const advice = () => modal.locator('[data-testid="conn-advice"]').innerText();
  ok(await modal.locator('[data-provider]').count() === 4, 'the window offers Neon, Supabase, Railway and another PostgreSQL');
  await modal.locator('[data-provider="neon"]').click();
  ok((await modal.locator('[data-guide="neon"]').innerText()).includes('Connection pooling'), 'Neon: its own steps');
  await conn.fill('postgresql://u:p@ep-cool-1.us-east-2.aws.neon.tech/neondb?sslmode=require');
  ok((await advice()).includes('-pooler'), 'Neon: a direct (not pooled) link is flagged');
  await modal.locator('[data-provider="supabase"]').click();
  ok((await modal.locator('[data-guide="supabase"]').innerText()).includes('Transaction pooler'), 'Supabase: its own steps');
  await conn.fill('postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres');
  ok((await advice()).includes('IPv6') && (await advice()).includes('[YOUR-PASSWORD]'), 'Supabase: the direct link and the missing password are flagged');
  await modal.locator('[data-provider="railway"]').click();
  await conn.fill('postgresql://postgres:x@postgres.railway.internal:5432/railway');
  ok((await advice()).includes('DATABASE_PUBLIC_URL'), 'Railway: the internal address is flagged');
  await modal.locator('[data-provider="postgres"]').click();
  await modal.locator('button:has-text("إدخال الحقول")').click();
  await modal.locator('input[aria-label="الخادم"]').fill('db.example.org');
  await modal.locator('input[aria-label="اسم المستخدم"]').fill('lab');
  await modal.locator('input[aria-label="كلمة المرور"]').fill('p@ss');
  ok((await conn.inputValue()).startsWith('postgresql://lab:p%40ss@db.example.org:5432/'), 'another PostgreSQL: the fields write the link');
  const bad = new URL(db.url); bad.password = 'wrong-pass';
  await conn.fill(bad.toString());
  await modal.locator('button:has-text("اختبار الاتصال")').click();
  ok(((await waitFor(() => msg(), 15000)) || '').includes('تعذّر الدخول'), 'wrong password → «تعذّر الدخول»');
  await conn.fill(db.url);
  await modal.locator('button:has-text("اختبار الاتصال")').click();
  ok(((await waitFor(async () => { const t = await msg(); return t.includes('يعمل') && t; }, 60000)) || '').includes('المستخدمون: 0'), 'test: the connection works, tables made, no users yet');
  const tables = (await db.query(`select count(*)::int as n from lab_admin_migrations`))[0].n;
  ok(tables >= 14 && (await db.query(`select to_regclass('public.station_licenses') is null as none`))[0].none, `the panel's migrations ran (${tables}), the codes' tables left out`);
  await modal.locator('button:has-text("حفظ")').click();
  // (the test message above also names «المدير الأول», so wait for the refusal's own words)
  ok(((await waitFor(async () => { const t = await msg(); return t.includes('بلا مستخدمين') && t; }, 15000)) || '').length > 0, 'saving a database with no users asks for the first admin');
  await modal.locator('input[aria-label="اسم مستخدم المدير"]').fill('labadmin');
  await modal.locator('input[aria-label="كلمة مرور المدير"]').fill('lab-pass-1');
  await modal.locator('button:has-text("حفظ")').click();
  // «بانتظار قاعدة خاصة» (before) also holds «قاعدة خاصة»: wait for the saved state itself.
  const ownDb = async () => (await card.locator('[data-testid="admin-db"] button').innerText()).trim().startsWith('قاعدة خاصة');
  await waitFor(ownDb, 30000);
  ok(await ownDb(), 'card: the panel is on the lab\'s own database');
  const users = await db.query(`select username, role from app_users`);
  ok(users.length === 1 && users[0].username === 'labadmin' && users[0].role === 'admin', 'the first admin is in the lab\'s database');
  const backup = JSON.stringify((await api({ op: 'backup' })).backup);
  ok(backup.includes('admin_db') && !backup.includes(pgPass) && !backup.includes(db.url), 'codes backup keeps it sealed (no password)');

  // ── The device now works on the lab's database only ──
  await p.goto(B + '/');
  ok(new URL(p.url()).pathname === '/login', 'back to login on the new database');
  ok(!(await signInOn(p, 'secadmin', 'sec-pass-2')), 'the section\'s accounts do not open the lab\'s own database');
  ok(await signInOn(p, 'labadmin', 'lab-pass-1'), 'the lab\'s admin signs in');
  const broken = [];
  for (const r of ROUTES) {
    const res = await p.goto(B + r, { waitUntil: 'domcontentloaded' });
    if (!res || res.status() >= 500 || p.url().includes('/login')) broken.push(`${r} → ${res ? res.status() : 'no reply'}`);
  }
  ok(broken.length === 0, `${ROUTES.length} admin pages open on the lab's database` + (broken.length ? ': ' + broken.join(', ') : ''));
  ok(!(await lists(p, SAMPLE)), 'the site\'s data is not in the lab\'s database');
  const name = 'مريض القاعدة الخاصة ' + TAG;
  await addPatient(p, name);
  ok((await db.query(`select count(*)::int as n from patients where full_name = $1`, [name]))[0].n === 1, 'a new patient is saved in the lab\'s database');
  await p.goto(B + '/settings#database'); await p.waitForSelector('[data-testid="lab-db-card"]', { timeout: 15000 });
  const sc = p.locator('[data-testid="lab-db-card"]');
  ok((await sc.innerText()).includes('ضبطها صاحب الرموز') && (await sc.locator('input').count()) === 0, 'Settings: set by the owner → the lab cannot change it');
  await p.goto(B + '/verify/not-a-token?l=' + encodeURIComponent(c.row.id));
  ok((await p.content()).length > 0 && errs.length === 0, 'report check with the lab\'s code opens');

  // ── «قواعد البيانات»: a tab per provider, checks, password, tests, a database that stops answering ──
  await o.goto(B + '/licenses#databases'); await o.reload(); await o.waitForSelector('[data-testid="db-list"]', { timeout: 15000 });
  ok(await o.locator('[data-provider-tab]').count() === 5, 'databases section: tabs — all, Neon, Supabase, Railway, other PostgreSQL');
  for (const [t, word] of [['neon', 'console.neon.tech'], ['supabase', 'Transaction pooler'], ['railway', 'DATABASE_PUBLIC_URL']]) {
    await o.click(`[data-provider-tab="${t}"]`);
    ok((await o.locator('[data-testid="provider-panel"]').innerText()).includes(word), `${t} tab: its own steps to link a client`);
  }
  // Lab 2 (waiting) linked from the «PostgreSQL آخر» tab.
  await o.click('[data-provider-tab="postgres"]');
  const fromTab = await o.locator('select[aria-label="العميل"] option', { hasText: LAB2 }).getAttribute('value');
  await o.locator('select[aria-label="العميل"]').selectOption(fromTab);
  await o.click('button:has-text("متابعة الربط")');
  ok(await modal.locator('[data-provider="postgres"][aria-selected="true"]').count() === 1, 'linking from a provider tab opens that provider\'s interface');
  await conn.fill(db4.url);
  await modal.locator('input[aria-label="اسم مستخدم المدير"]').fill('nbadmin');
  await modal.locator('input[aria-label="كلمة مرور المدير"]').fill('nb-pass-2');
  await modal.locator('button:has-text("حفظ")').click();
  const item2 = o.locator(`li[data-db-lab="${LAB2}"]`);
  await waitFor(async () => (await item2.locator('[data-testid="db-state"]').innerText()).includes('ضبطتها أنت'), 15000);
  ok((await item2.locator('[data-testid="db-state"]').innerText()).includes('PostgreSQL آخر'), 'lab 2 linked, listed under its provider');
  ok(await signInOn(p2, 'nbadmin', 'nb-pass-2'), 'lab 2 signs in on its own database');
  await o.click('[data-provider-tab="all"]');
  ok((await item.locator('[data-testid="db-check"]').innerText()).includes('تعمل'), 'a link starts as a successful check');
  await item.locator('button:has-text("فحص")').click();
  ok(((await waitFor(async () => { const t = await item.locator('[data-testid="db-check"]').innerText().catch(() => ''); return t.includes('مستخدم') && t; }, 20000)) || '').includes('1 مستخدم'), '«فحص» — works, 1 user');

  await item.locator('button:has-text("كلمة مرور المدير")').click();
  await rm.locator('input[aria-label="اسم مستخدم المدير"]').fill('labadmin');
  await rm.locator('input[aria-label="كلمة المرور الجديدة"]').fill('new-pass-2');
  await rm.locator('input[aria-label="تأكيد كلمة المرور"]').fill('new-pass-2');
  await rm.locator('button:has-text("حفظ كلمة المرور")').click();
  ok(((await waitFor(() => rm.locator('[data-testid="reset-admin-msg"]').innerText().catch(() => ''), 15000)) || '').includes('تغيّرت كلمة المرور'), 'owner: the lab admin\'s password changed (own database)');
  await rm.locator('button:has-text("إغلاق")').click();
  await p.goto(B + '/'); await p.waitForTimeout(300);
  ok(!(await signInOn(p, 'labadmin', 'lab-pass-1')) && await signInOn(p, 'labadmin', 'new-pass-2'), 'only the new password opens the panel');

  await p.goto(B + '/settings#tests'); await p.waitForSelector('[data-testid="import-tests-card"]', { timeout: 15000 });
  await p.click('button:has-text("استيراد قائمة الفحوصات الافتراضية")');
  const imported = (await waitFor(() => p.locator('[data-testid="import-tests-msg"]').innerText().catch(() => ''), 20000)) || '';
  const nTests = (await db.query(`select count(*)::int as n from test_catalog`))[0].n;
  ok(imported.includes('أُضيف') && nTests >= 40, `default tests imported into the lab's database (${nTests})`);
  await p.click('button:has-text("استيراد قائمة الفحوصات الافتراضية")');
  ok(((await waitFor(async () => { const t = await p.locator('[data-testid="import-tests-msg"]').innerText().catch(() => ''); return t.includes('أُضيف 0') && t; }, 20000)) || '').length > 0
    && (await db.query(`select count(*)::int as n from test_catalog`))[0].n === nTests, 'importing again adds nothing (same codes kept)');

  const dbName = new URL(db.url).pathname.slice(1);
  const { Client } = require('pg');
  const su = new Client({ connectionString: PG }); await su.connect();
  await su.query(`alter database ${dbName} allow_connections false`);
  await su.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1`, [dbName]);
  await p.goto(B + '/patients');
  ok(!!(await waitFor(() => p.locator('[data-testid="lab-db-down"], [data-testid="lab-db-problem"]').count(), 20000)), 'database down mid-use: «قاعدة بيانات المختبر لا تستجيب»');
  await o.goto(B + '/licenses#databases'); await o.reload(); await o.waitForSelector('[data-testid="db-list"]', { timeout: 15000 });
  ok(((await waitFor(async () => { const t = await item.locator('[data-testid="db-check"]').innerText(); return t.includes('لا تستجيب') && t; }, 30000)) || '').length > 0, 'owner\'s list: the database is marked as not answering');
  ok((await o.locator('[data-testid="badge-databases"]').innerText()) === '1' && (await o.locator('[data-testid="db-down-count"]').innerText()) === '1', 'side menu and summary count it');
  await su.query(`alter database ${dbName} allow_connections true`); await su.end();
  await p.goto(B + '/patients'); await p.waitForTimeout(500);
  ok(await p.locator('[data-testid="lab-db-down"], [data-testid="lab-db-problem"]').count() === 0, 'back up: the panel works again');
  await item.locator('button:has-text("فحص")').click();
  await waitFor(async () => (await item.locator('[data-testid="db-check"]').innerText()).includes('تعمل'), 20000);
  ok(await o.locator('[data-testid="badge-databases"]').count() === 0, 'checked again: no longer counted');
  errs.length = 0; // the error page above is expected

  // ── Owner unlinks it: the panel closes again (rule on), and the lab links a database itself ──
  await item.locator('button:has-text("تغيير")').click();
  await modal.locator('button:has-text("إلغاء ربط القاعدة")').click();
  await waitFor(async () => (await item.locator('[data-testid="db-state"]').innerText()).includes('بانتظار'), 15000);
  ok((await item.locator('[data-testid="db-state"]').innerText()).includes('بانتظار قاعدة خاصة'), 'owner: unlinked → waiting for a database');
  await p.goto(B + '/'); await p.goto(B + '/login'); await p.waitForSelector('[data-testid="needs-db"]', { timeout: 20000 });
  const gate = p.locator('[data-testid="needs-db"]');
  ok(await gate.locator('[data-provider]').count() === 4, 'the lab\'s gate offers the same provider interfaces');
  await gate.locator('[data-provider="postgres"]').click();
  await gate.locator('input[aria-label="رابط قاعدة المختبر"]').fill(db2.url);
  await gate.locator('button:has-text("ربط القاعدة")').click();
  await p.waitForSelector('[data-testid="first-run"]', { timeout: 60000 });
  ok(true, 'the lab linked its database from the gate → first-admin form');
  ok(await firstRun(p, 'admin', 'lab-own-1'), 'the lab creates its first admin and is in');
  await addPatient(p, 'مريض القاعدة الثانية ' + TAG);
  ok((await db2.query(`select count(*)::int as n from patients`))[0].n === 1, 'working on the database it linked');

  // ── The lab's admin moves the panel from Settings (with its data) ──
  await p.goto(B + '/settings#database'); await p.waitForSelector('[data-testid="lab-db-card"]', { timeout: 15000 });
  ok((await sc.innerText()).includes(new URL(db2.url).hostname), 'Settings: its database is shown');
  await sc.locator('[data-provider="postgres"]').click();
  await sc.locator('input[aria-label="رابط قاعدة المختبر"]').fill(db3.url);
  await sc.locator('input[aria-label="نسخ بيانات قاعدة الموقع"]').check();
  await sc.locator('button:has-text("حفظ ونقل اللوحة إليها")').click();
  await p.waitForURL((u) => u.pathname === '/login', { timeout: 60000 }).catch(() => {});
  ok(new URL(p.url()).pathname === '/login', 'after saving: sign in again');
  const u3 = await db3.query(`select username from app_users`);
  const p3 = await db3.query(`select count(*)::int as n from patients`);
  ok(u3.length === 1 && u3[0].username === 'admin' && p3[0].n === 1, 'its accounts and patients came along');
  ok(await signInOn(p, 'admin', 'lab-own-1'), 'the same admin signs in on the new database');
  await p.goto(B + '/settings#database'); await p.waitForSelector('[data-testid="lab-db-card"]', { timeout: 15000 });
  await sc.locator('button:has-text("إرجاع لقسم المختبر")').click();
  ok(((await waitFor(() => sc.locator('[data-testid="lab-db-msg"]').innerText().catch(() => ''), 15000)) || '').includes('لا يمكن إرجاعها'), 'with the rule on, the lab cannot go back to the site\'s database');
  await o.goto(B + '/licenses'); await o.waitForSelector(`div[data-lab="${LAB}"]`, { timeout: 15000 });
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('(من المختبر)'), 'owner card: «قاعدة خاصة (من المختبر)»');

  await api({ op: 'prefs', prefs: {} }); // back to the defaults for the other files
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  for (const d of [db, db2, db3, db4]) await d.drop().catch(() => {});
  done();
})().catch((e) => { console.error(e); process.exit(1); });
