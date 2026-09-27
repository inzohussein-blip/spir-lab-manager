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

  // ── Owner gives the code its own database ──
  await o.goto(B + '/licenses'); await o.waitForSelector(`div[data-lab="${LAB}"]`, { timeout: 15000 });
  const card = o.locator(`div[data-lab="${LAB}"]`);
  ok((await card.locator('[data-testid="admin-db"]').innerText()).includes('قاعدة الموقع'), 'card: the panel is on the site\'s database');
  await card.locator('button[aria-label="قاعدة لوحة الإدارة"]').click();
  const modal = o.locator('[data-testid="admin-db-modal"]');
  const msg = () => modal.locator('[data-testid="admin-db-msg"]').innerText();
  const bad = new URL(db.url); bad.password = 'wrong-pass';
  await modal.locator('input[aria-label="رابط قاعدة لوحة الإدارة"]').fill(bad.toString());
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
  await db.drop().catch(() => {}); await db2.drop().catch(() => {});
  done();
})().catch((e) => { console.error(e); process.exit(1); });
