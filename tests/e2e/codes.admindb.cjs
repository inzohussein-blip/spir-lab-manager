// The full admin panel on a lab's own PostgreSQL: the owner sets it for a code in /licenses (a new
// database gets its tables and a first admin), the lab's device then works only on it, signing in
// again with the lab's accounts; the owner can put it back on the site's database; and the lab's
// admin can move the panel to a database of its own from Settings (their account comes along).
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const { PG, freshDb, waitFor } = require('./pgfake.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.43' };
const LAB = 'مختبر القاعدة الخاصة ' + Date.now().toString(36);
const ROUTES = ['/', '/appointments', '/audit', '/calendar', '/insights', '/inventory', '/invoices', '/orders', '/orders/new',
  '/orders-expenses', '/patients', '/patients/new', '/purchase-orders', '/quality', '/referrers', '/release', '/reorder', '/settings',
  '/staff', '/stock-balance', '/suppliers', '/tests', '/tools', '/users', '/worklist'];

(async () => {
  if (!PG) { console.log('SKIP codes.admindb.cjs — set E2E_PG_URL'); ok(!process.env.CI, 'E2E_PG_URL is set in CI'); return done(); }
  const db = await freshDb('admindb');
  const db2 = await freshDb('admindb2');
  const db3 = await freshDb('admindb3');
  const pgPass = new URL(PG).password;
  const b = await launch();
  const errs = [];
  const o = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR })).newPage();
  o.on('dialog', (d) => d.accept());
  await o.goto(B + '/licenses');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  const c = await api({ op: 'create', lab: LAB, days: 30, modules: ['station', 'admin'] });
  ok(!!c.code && c.row.modules.includes('admin'), 'a code with the full admin panel');

  // ── The lab's device: activates, signs in on the site's database ──
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
  await p.fill('input[aria-label="رمز المختبر"]', c.code); await p.click('button:has-text("تفعيل")'); await p.waitForTimeout(1500);
  ok((await ctx.cookies()).some((x) => x.name === 'lab_lic_admin'), 'the device has the admin-panel cookie');
  const signIn = async (user, pass) => {
    await p.goto(B + '/login'); await p.waitForSelector('input[name="username"]', { timeout: 20000 });
    await p.fill('input[name="username"]', user); await p.fill('input[name="password"]', pass);
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
    return !new URL(p.url()).pathname.startsWith('/login');
  };
  ok(await signIn('admin', 'admin123'), 'site database: the demo admin signs in');
  await p.goto(B + '/patients');
  ok((await p.content()).includes('محمد عبدالله السالم'), 'site database: its sample patient is listed');

  // ── The owner's general settings: what a new code starts with ──
  await o.goto(B + '/licenses#settings'); await o.reload(); await o.waitForSelector('[data-testid="prefs-card"]', { timeout: 15000 });
  ok(await o.locator('input[aria-label="سطر التواصل"]').count() === 1, 'settings section: holds the contact line too');
  const prefs = o.locator('[data-testid="prefs-card"]');
  await prefs.locator('select[aria-label="مدة الرمز الافتراضية"]').selectOption('90');
  await prefs.locator('input[aria-label="أيام الرمز التجريبي"]').fill('10');
  await prefs.locator('button[aria-pressed]:has-text("لوحة الإدارة الكاملة")').click();
  await prefs.locator('button:has-text("حفظ الإعدادات")').click();
  await waitFor(async () => (await prefs.locator('[data-testid="prefs-msg"]').innerText().catch(() => '')).includes('حُفظت'), 10000);
  await o.goto(B + '/licenses#new'); await o.reload(); await o.waitForSelector('text=إنشاء الرمز', { timeout: 15000 });
  ok(await o.locator('form select').first().inputValue() === '90', 'a new code starts with the default period (3 months)');
  ok(await o.locator('form button[aria-pressed="true"]:has-text("لوحة الإدارة الكاملة")').count() === 1, 'and with the default stations (admin panel on)');
  ok(await o.locator('button:has-text("رمز تجريبي 10")').count() === 1, 'trial length from the settings (10 days)');
  ok(await o.locator('[data-section="contact"]').count() === 0 && await o.locator('[data-section="databases"]').count() === 1, 'side menu: «قواعد البيانات» and «الإعدادات العامة»');
  await api({ op: 'prefs', prefs: {} }); // back to the defaults for the other files

  // ── Owner gives the code its own database ──
  await o.goto(B + '/licenses'); await o.waitForSelector(`div[data-lab="${LAB}"]`, { timeout: 15000 });
  const card = o.locator(`div[data-lab="${LAB}"]`);
  ok(await card.locator('[data-testid="lab-db"]').count() === 0, 'card: no station-sync column (station sync off)');
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('قاعدة الموقع'), 'card: the panel is on the site\'s database');
  await card.locator('button[aria-label="قاعدة لوحة الإدارة"]').click();
  const modal = o.locator('[data-testid="admin-db-modal"]');
  const msg = () => modal.locator('[data-testid="admin-db-msg"]').innerText();
  // One interface per provider: its steps, and advice on the link before it is tried.
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
  await modal.locator('input[aria-label="رابط قاعدة لوحة الإدارة"]').fill(db.url);
  await modal.locator('button:has-text("اختبار الاتصال")').click();
  ok(((await waitFor(async () => { const t = await msg(); return t.includes('يعمل') && t; }, 60000)) || '').includes('المستخدمون: 0'), 'test: the connection works, tables made, no users yet');
  const tables = (await db.query(`select count(*)::int as n from lab_admin_migrations`))[0].n;
  ok(tables >= 14 && (await db.query(`select to_regclass('public.station_licenses') is null as none`))[0].none, `the panel's migrations ran (${tables}), the codes' tables left out`);
  await modal.locator('button:has-text("حفظ")').click();
  ok(((await waitFor(async () => { const t = await msg(); return t.includes('المدير الأول') && t; }, 15000)) || '').length > 0, 'saving a database with no users asks for the first admin');
  await modal.locator('input[aria-label="اسم مستخدم المدير"]').fill('labadmin');
  await modal.locator('input[aria-label="كلمة مرور المدير"]').fill('lab-pass-1');
  await modal.locator('button:has-text("حفظ")').click();
  await waitFor(async () => (await card.locator('[data-testid="admin-db"]').innerText()).includes('قاعدة خاصة'), 15000);
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('قاعدة خاصة'), 'card: the panel is on the lab\'s own database');
  const users = await db.query(`select username, role from app_users`);
  ok(users.length === 1 && users[0].username === 'labadmin' && users[0].role === 'admin', 'the first admin is in the lab\'s database');
  const backup = JSON.stringify((await api({ op: 'backup' })).backup);
  ok(backup.includes('admin_db') && !backup.includes(pgPass) && !backup.includes(db.url), 'codes backup keeps it sealed (no password)');

  // ── The device now works on the lab's database only ──
  await p.goto(B + '/');
  ok(new URL(p.url()).pathname === '/login', 'the sign-in from the site\'s database no longer holds (back to login)');
  ok(!(await signIn('admin', 'admin123')), 'the site\'s accounts do not open the lab\'s panel');
  ok(await signIn('labadmin', 'lab-pass-1'), 'the lab\'s admin signs in');
  const broken = [];
  for (const r of ROUTES) {
    const res = await p.goto(B + r, { waitUntil: 'domcontentloaded' });
    if (!res || res.status() >= 500 || p.url().includes('/login')) broken.push(`${r} → ${res ? res.status() : 'no reply'}`);
  }
  ok(broken.length === 0, `${ROUTES.length} admin pages open on the lab's database` + (broken.length ? ': ' + broken.join(', ') : ''));
  await p.goto(B + '/patients');
  ok(!(await p.content()).includes('محمد عبدالله السالم'), 'the site\'s patients are not in the lab\'s panel');
  const name = 'مريض القاعدة الخاصة ' + Date.now().toString().slice(-5);
  await p.goto(B + '/patients/new');
  await p.fill('input[name="full_name"]', name); await p.fill('input[name="age_years"]', '40'); await p.fill('input[name="phone"]', '07712345678');
  await p.click('button:has-text("حفظ المريض")'); await p.waitForTimeout(2500);
  ok((await db.query(`select count(*)::int as n from patients where full_name = $1`, [name]))[0].n === 1, 'a new patient is saved in the lab\'s database');
  await p.goto(B + '/settings');
  const sc = p.locator('[data-testid="lab-db-card"]');
  ok((await sc.innerText()).includes('ضبطها صاحب الرموز') && (await sc.locator('input').count()) === 0, 'Settings: set by the owner → the lab cannot change it');
  await p.goto(B + '/verify/not-a-token?l=' + encodeURIComponent(c.row.id));
  ok((await p.content()).length > 0 && errs.length === 0, 'report check with the lab\'s code opens');

  // ── Owner puts it back on the site's database ──
  await card.locator('button[aria-label="قاعدة لوحة الإدارة"]').click();
  await modal.locator('button:has-text("إرجاع لقاعدة الموقع")').click();
  await waitFor(async () => (await card.locator('[data-testid="admin-db"]').innerText()).includes('قاعدة الموقع'), 15000);
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('قاعدة الموقع'), 'owner: back on the site\'s database');
  await p.goto(B + '/');
  ok(new URL(p.url()).pathname === '/login', 'the lab\'s sign-in ends with it');
  ok(await signIn('admin', 'admin123'), 'the site\'s admin signs in again');
  await p.goto(B + '/patients');
  ok((await p.content()).includes('محمد عبدالله السالم'), 'and sees the site\'s data again');

  // ── «قواعد البيانات»: every client's admin-panel database in one place, a tab per provider ──
  await o.goto(B + '/licenses#databases'); await o.reload(); await o.waitForSelector('[data-testid="db-list"]', { timeout: 15000 });
  const item = o.locator(`li[data-db-lab="${LAB}"]`);
  ok((await item.locator('[data-testid="db-state"]').innerText()).includes('قاعدة الموقع'), 'databases section: the client is listed, on the site\'s database');
  ok(await o.locator('[data-provider-tab]').count() === 5, 'databases section: tabs — all, Neon, Supabase, Railway, other PostgreSQL');
  for (const [t, word] of [['neon', 'console.neon.tech'], ['supabase', 'Transaction pooler'], ['railway', 'DATABASE_PUBLIC_URL']]) {
    await o.click(`[data-provider-tab="${t}"]`);
    ok((await o.locator('[data-testid="provider-panel"]').innerText()).includes(word), `${t} tab: its own steps to link a client`);
  }
  await o.click('[data-provider-tab="postgres"]');
  const fromTab = await o.locator('select[aria-label="العميل"] option', { hasText: LAB }).getAttribute('value');
  await o.locator('select[aria-label="العميل"]').selectOption(fromTab);
  await o.click('button:has-text("متابعة الربط")');
  ok(await modal.locator('[data-provider="postgres"][aria-selected="true"]').count() === 1, 'linking from a provider tab opens that provider\'s interface');
  await modal.locator('input[aria-label="رابط قاعدة لوحة الإدارة"]').fill(db.url);
  await modal.locator('button:has-text("حفظ")').click();
  await waitFor(async () => (await item.locator('[data-testid="db-state"]').innerText()).includes('ضبطتها أنت'), 15000);
  ok((await item.locator('[data-testid="db-state"]').innerText()).includes('PostgreSQL آخر'), 'databases section: linked, listed under its provider');
  ok((await item.locator('[data-testid="db-check"]').innerText()).includes('تعمل'), 'the link starts as a successful check');
  await item.locator('button:has-text("فحص")').click();
  ok(((await waitFor(async () => { const t = await item.locator('[data-testid="db-check"]').innerText().catch(() => ''); return t.includes('مستخدم') && t; }, 20000)) || '').includes('1 مستخدم'), 'databases section: «فحص» — works, 1 user');

  // The owner sets a new password for the lab's admin (in the lab's own database).
  await item.locator('button:has-text("كلمة مرور المدير")').click();
  const rm = o.locator('[data-testid="reset-admin-modal"]');
  await rm.locator('input[aria-label="اسم مستخدم المدير"]').fill('labadmin');
  await rm.locator('input[aria-label="كلمة المرور الجديدة"]').fill('new-pass-2');
  await rm.locator('input[aria-label="تأكيد كلمة المرور"]').fill('new-pass-2');
  await rm.locator('button:has-text("حفظ كلمة المرور")').click();
  ok(((await waitFor(() => rm.locator('[data-testid="reset-admin-msg"]').innerText().catch(() => ''), 15000)) || '').includes('تغيّرت كلمة المرور'), 'owner: the lab admin\'s password changed');
  await rm.locator('button:has-text("إغلاق")').click();
  await p.goto(B + '/'); await p.waitForURL((u) => u.pathname === '/login', { timeout: 15000 }).catch(() => {});
  ok(!(await signIn('labadmin', 'lab-pass-1')), 'the old password no longer opens the panel');
  ok(await signIn('labadmin', 'new-pass-2'), 'the new password does');

  // Settings in the panel: the built-in test list for a new database.
  await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="import-tests-card"]', { timeout: 15000 });
  await p.click('button:has-text("استيراد قائمة الفحوصات الافتراضية")');
  const imported = (await waitFor(() => p.locator('[data-testid="import-tests-msg"]').innerText().catch(() => ''), 20000)) || '';
  const nTests = (await db.query(`select count(*)::int as n from test_catalog`))[0].n;
  ok(imported.includes('أُضيف') && nTests >= 40, `default tests imported into the lab's database (${nTests})`);
  await p.click('button:has-text("استيراد قائمة الفحوصات الافتراضية")');
  ok(((await waitFor(async () => { const t = await p.locator('[data-testid="import-tests-msg"]').innerText().catch(() => ''); return t.includes('أُضيف 0') && t; }, 20000)) || '').length > 0
    && (await db.query(`select count(*)::int as n from test_catalog`))[0].n === nTests, 'importing again adds nothing (same codes kept)');

  // The lab's database stops answering mid-use: a plain message, and the owner's list shows it.
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

  await item.locator('button:has-text("تغيير")').click();
  await modal.locator('button:has-text("إرجاع لقاعدة الموقع")').click();
  await waitFor(async () => (await item.locator('[data-testid="db-state"]').innerText()).includes('قاعدة الموقع'), 15000);
  ok((await item.locator('[data-testid="db-state"]').innerText()).includes('قاعدة الموقع'), 'databases section: back to the site\'s database');
  await p.goto(B + '/'); await p.waitForURL((u) => u.pathname === '/login', { timeout: 15000 }).catch(() => {});
  ok(await signIn('admin', 'admin123'), 'the device signs in on the site\'s database again');

  // Linking with «انسخ بيانات لوحته الحالية»: the site's data comes along.
  const cp = await api({ op: 'admin_db_set', id: c.row.id, conn: db3.url, copy: true });
  ok(cp.ok && cp.copied && cp.copied.rows > 0, `copy: ${cp.copied ? cp.copied.rows + ' records from ' + cp.copied.tables + ' tables' : JSON.stringify(cp)}`);
  const p3 = await db3.query(`select count(*)::int as n from patients where full_name = 'محمد عبدالله السالم'`);
  const a3 = await db3.query(`select count(*)::int as n from app_users where username = 'admin'`);
  ok(p3[0].n === 1 && a3[0].n === 1, 'the lab\'s new database has the site\'s patients and accounts');
  const again = await api({ op: 'admin_db_set', id: c.row.id, conn: db3.url, copy: true });
  ok(again.ok && !again.copied, 'saving the same database again copies nothing');
  ok((await api({ op: 'admin_db_set', id: c.row.id, conn: null })).ok, 'back on the site\'s database');
  await p.goto(B + '/patients');
  ok((await p.content()).includes('محمد عبدالله السالم'), 'the device is on the site\'s database again');

  // ── The lab's admin moves the panel to a database of its own (Settings) ──
  await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="lab-db-card"]', { timeout: 15000 });
  ok((await sc.innerText()).includes('قاعدة الموقع المشتركة'), 'Settings: on the site\'s database');
  await sc.locator('input[aria-label="رابط قاعدة المختبر"]').fill(db2.url);
  await sc.locator('button:has-text("اختبار الاتصال")').click();
  ok(((await waitFor(async () => { const t = await sc.locator('[data-testid="lab-db-msg"]').innerText().catch(() => ''); return t.includes('يعمل') && t; }, 60000)) || '').includes('سيُنسخ حسابك'), 'Settings: test works, the admin\'s account will be copied');
  await sc.locator('button:has-text("حفظ ونقل اللوحة إليها")').click();
  await p.waitForURL((u) => u.pathname === '/login', { timeout: 30000 }).catch(() => {});
  ok(new URL(p.url()).pathname === '/login', 'after saving: sign in again');
  const u2 = await db2.query(`select username from app_users`);
  ok(u2.length === 1 && u2[0].username === 'admin', 'the admin\'s account was copied to the new database');
  ok(await signIn('admin', 'admin123'), 'the same admin signs in on the lab\'s database');
  await p.goto(B + '/patients');
  ok(!(await p.content()).includes('محمد عبدالله السالم'), 'the panel now shows the lab\'s database');
  await o.goto(B + '/licenses'); await o.waitForSelector(`div[data-lab="${LAB}"]`, { timeout: 15000 });
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('(من المختبر)'), 'owner card: «قاعدة خاصة (من المختبر)»');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  await db.drop().catch(() => {}); await db2.drop().catch(() => {}); await db3.drop().catch(() => {});
  done();
})().catch((e) => { console.error(e); process.exit(1); });
