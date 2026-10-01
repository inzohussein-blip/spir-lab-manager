// Owner features that start switched off in «الإعدادات العامة»: several devices on one code, a lab
// registering itself (/signup), the error log, and the hidden export of a lab's data (Excel).
// Also: the admin panel's long lists are paged.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const { waitFor } = require('./pgfake.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.44' };
const TAG = Date.now().toString(36);
const LAB = 'مختبر الأجهزة ' + TAG;

(async () => {
  const b = await launch();
  const errs = [];
  const o = await (await b.newContext({ viewport: { width: 1300, height: 950 }, extraHTTPHeaders: HDR, acceptDownloads: true })).newPage();
  o.on('dialog', (d) => d.accept());
  await o.goto(B + '/license');
  const api = (body) => o.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  ok((await api({ op: 'login', password: OWNER })).ok === true, 'owner signs in');
  const device = async () => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, extraHTTPHeaders: HDR });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await p.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
    return { ctx, p };
  };
  const activate = async (p, code) => {
    await p.fill('input[aria-label="رمز المختبر"]', code); await p.click('button:has-text("تفعيل")'); await p.waitForTimeout(1500);
    return (await p.locator('div[role=dialog]:has-text("تفعيل المحطات")').count()) === 0;
  };

  // ── Off by default ──
  await o.goto(B + '/license#settings'); await o.reload(); await o.waitForSelector('[data-testid="extra-features"]', { timeout: 15000 });
  const feat = (label) => o.locator(`input[aria-label="${label}"]`);
  ok(!(await feat('حساب واحد بعدة أجهزة').isChecked()) && !(await feat('التسجيل الذاتي').isChecked()) && !(await feat('سجل الأخطاء').isChecked()), 'extra features: off by default');
  ok(!(await o.locator('[data-testid="secret-features"]').getAttribute('open') !== null) && !(await feat('تصدير بيانات المختبر').isVisible()), 'secret feature: folded away');
  ok(await o.locator('[data-section="errors"]').count() === 0, 'no «سجل الأخطاء» in the menu while off');
  const { p: s0 } = await device();
  ok(await s0.locator('[data-testid="signup-link"]').count() === 0, 'activation window: no signup link while off');
  await s0.goto(B + '/signup'); await s0.waitForSelector('[data-testid="signup-closed"]', { timeout: 15000 });
  ok(true, '/signup is closed while off');
  const closed = await s0.evaluate(async () => (await fetch('/api/license/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lab: 'x', phone: '07700000000' }) })).status);
  ok(closed === 403, 'registration refused by the server while off');

  // ── Switch them on ──
  await feat('حساب واحد بعدة أجهزة').check(); await feat('التسجيل الذاتي').check(); await feat('سجل الأخطاء').check();
  await o.locator('[data-testid="secret-features"] summary').click();
  await feat('تصدير بيانات المختبر').check();
  await o.locator('button:has-text("حفظ الإعدادات")').click();
  await waitFor(async () => (await o.locator('[data-testid="prefs-msg"]').innerText().catch(() => '')).includes('حُفظت'), 10000);
  await o.reload(); await o.waitForSelector('[data-section="errors"]', { timeout: 15000 });
  ok(true, '«سجل الأخطاء» shows in the menu once on');

  // ── Several devices on one code ──
  await o.goto(B + '/license#new'); await o.reload(); await o.waitForSelector('input[aria-label="عدد الأجهزة"]', { timeout: 15000 });
  ok(true, '«رمز جديد» asks for the number of devices');
  const c = await api({ op: 'create', lab: LAB, days: 30, modules: ['station', 'admin'], trial: true, maxDevices: 2 });
  ok(c.row.max_devices === 2, 'a code for 2 devices');
  const { p: d1 } = await device(); const { p: d2 } = await device(); const { p: d3 } = await device();
  ok(await activate(d1, c.code), 'device 1 activates');
  ok(await activate(d2, c.code), 'device 2 activates with the same code');
  ok(!(await activate(d3, c.code)) && await d3.locator('text=مفعّل على جهاز آخر').count() === 1, 'device 3 is refused (2 allowed)');
  await o.goto(B + '/license'); await o.waitForSelector(`div[data-lab="${LAB}"]`, { timeout: 15000 });
  const card = o.locator(`div[data-lab="${LAB}"]`);
  ok((await card.innerText()).includes('2 / 2'), 'card: 2 / 2 devices');
  await card.locator('button:has-text("الدفع والجهاز والرسالة")').click();
  const devs = card.locator('[data-testid="devices"]');
  ok(await devs.locator('li').count() === 1, 'details: the extra device is listed');
  await devs.locator('button:has-text("إزالة")').click(); await o.waitForTimeout(800);
  ok(await devs.locator('li').count() === 0, 'owner removes the extra device');
  await d2.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  await d2.goto(B + '/welcome'); await d2.waitForTimeout(2500);
  await d2.goto(B + '/station'); await d2.waitForTimeout(1500);
  ok(await d2.locator('text=مفعّل على جهاز آخر').count() + await d2.locator('text=لم يعد').count() + await d2.locator('div[role=dialog]').count() > 0, 'the removed device is locked at its next check');
  ok(await activate(d3, c.code), 'device 3 can take the free place');

  // ── A lab registers itself ──
  const { p: s1 } = await device();
  await s1.reload(); await s1.waitForSelector('[data-testid="signup-link"]', { timeout: 15000 });
  await s1.click('[data-testid="signup-link"]'); await s1.waitForSelector('[data-testid="signup"] form', { timeout: 15000 });
  const SELF = 'مختبر مسجّل ذاتياً ' + TAG;
  await s1.locator('label:has-text("اسم المختبر") input').fill(SELF);
  await s1.locator('label:has-text("رقم الهاتف") input').fill('07711112222');
  await s1.click('button:has-text("تسجيل وبدء التجربة")');
  await s1.waitForSelector('[data-testid="signup-done"]', { timeout: 20000 });
  ok(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test((await s1.locator('[data-testid="signup-code"]').innerText()).trim()), 'the lab gets its trial code');
  await s1.goto(B + '/welcome'); await s1.waitForTimeout(1500);
  ok(await s1.locator('div[role=dialog]:has-text("تفعيل المحطات")').count() === 0 && (await s1.locator('[data-testid="account-chip"]').innerText()).includes(SELF), 'this device is already activated with it');
  await o.goto(B + '/license'); await o.waitForSelector(`div[data-lab="${SELF}"]`, { timeout: 15000 });
  const sc = o.locator(`div[data-lab="${SELF}"]`);
  ok(await sc.locator('[data-testid="signup-badge"]').count() === 1 && (await sc.innerText()).includes('تجريبي'), 'owner list: «تسجيل ذاتي», trial');

  // ── Error log ──
  await d1.goto(B + '/station'); await d1.waitForTimeout(800);
  await d1.evaluate(() => fetch('/api/errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/station', message: 'خطأ تجريبي من المحطة' }) }));
  await d1.evaluate(() => setTimeout(() => { throw new Error('خطأ حقيقي في الصفحة'); }, 0)); await d1.waitForTimeout(1500);
  await o.goto(B + '/license#errors'); await o.reload(); await o.waitForSelector('[data-testid="errors-list"]', { timeout: 15000 });
  const elist = await o.locator('[data-testid="errors-list"]').innerText();
  ok(elist.includes('خطأ تجريبي من المحطة') && elist.includes('خطأ حقيقي في الصفحة') && elist.includes(LAB), 'errors from the lab\'s device are listed with its name');
  await o.click('button:has-text("مسح السجل")'); await o.waitForTimeout(800);
  ok(await o.locator('[data-testid="errors-list"] li').count() === 0, 'log cleared');
  errs.length = 0; // the page error above was on purpose

  // ── Paged lists in the admin panel ──
  await d1.goto(B + '/login'); await d1.waitForSelector('[data-testid="first-run"]', { timeout: 20000 });
  await d1.fill('input[name="full_name"]', 'مدير'); await d1.fill('input[name="username"]', 'devadmin');
  await d1.fill('input[name="password"]', 'dev-pass-1'); await d1.fill('input[name="again"]', 'dev-pass-1');
  await d1.click('button[type="submit"]'); await d1.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  const PATIENT = 'مريض التصدير ' + TAG;
  await d1.goto(B + '/patients/new');
  await d1.fill('input[name="full_name"]', PATIENT); await d1.fill('input[name="age_years"]', '33'); await d1.fill('input[name="phone"]', '07712345678');
  await d1.click('button:has-text("حفظ المريض")'); await d1.waitForTimeout(2000);
  await d1.goto(B + '/patients?page=2');
  const pager = d1.locator('[data-testid="pager"]');
  ok((await pager.innerText()).includes('صفحة 2') && await pager.locator('a:has-text("الأحدث")').count() === 1, 'patients list: pages («صفحة 2», «الأحدث»)');
  await d1.goto(B + '/patients');
  ok(await d1.locator('[data-testid="pager"]').count() === 0, 'a short list has no pager');

  // ── Hidden export of the lab's data ──
  await o.goto(B + '/license#databases'); await o.reload(); await o.waitForSelector(`li[data-db-lab="${LAB}"]`, { timeout: 15000 });
  await o.locator(`li[data-db-lab="${LAB}"] [data-testid="export-btn"]`).click();
  const em = o.locator('[data-testid="export-modal"]');
  await em.locator('input[aria-label="كلمة مرور المالك"]').fill('wrong-password');
  await em.locator('button:has-text("تصدير")').click();
  ok(((await waitFor(() => em.locator('[data-testid="export-msg"]').innerText().catch(() => ''), 10000)) || '').includes('غير صحيح'), 'export: a wrong password is refused');
  await em.locator('input[aria-label="كلمة مرور المالك"]').fill(OWNER);
  const [dl] = await Promise.all([o.waitForEvent('download', { timeout: 30000 }), em.locator('button:has-text("تصدير")').click()]);
  const file = require('node:fs').readFileSync(await dl.path());
  if (process.env.E2E_SAVE_XLSX) require('node:fs').writeFileSync(process.env.E2E_SAVE_XLSX, file); // to open it by hand
  ok(dl.suggestedFilename().endsWith('.xlsx') && file.slice(0, 2).toString() === 'PK', `export: an .xlsx file (${dl.suggestedFilename()}, ${file.length} bytes)`);
  const text = file.toString('utf8');
  ok(text.includes('xl/workbook.xml') && text.includes(PATIENT) && text.includes('المرضى'), 'the workbook holds the lab\'s patients (sheet «المرضى»)');
  ok(text.includes('devadmin') && !text.includes('password_hash'), 'accounts without their passwords');
  await em.locator('button:has-text("إغلاق")').click();

  await api({ op: 'prefs', prefs: {} }); // back to the defaults for the other files
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
