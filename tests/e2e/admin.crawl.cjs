// The full admin panel (lab codes off): sign in, then every page and the first record of each
// list opens without a server error or a page error.
const { B, ok, launch, done } = require('./lib.cjs');
const routes = ['/', '/appointments', '/audit', '/calendar', '/insights', '/inventory', '/invoices', '/orders', '/orders/new',
  '/orders-expenses', '/patients', '/patients/new', '/purchase-orders', '/quality', '/referrers', '/release', '/reorder', '/settings',
  '/staff', '/stock-balance', '/suppliers', '/tests', '/tools', '/users', '/worklist'];
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  await p.goto(B + '/login');
  await p.fill('input[name="username"]', 'admin'); await p.fill('input[name="password"]', 'admin123');
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
  ok(!p.url().includes('/login'), 'admin signs in');
  const bad = [];
  const visit = async (r) => {
    const res = await p.goto(B + r, { waitUntil: 'domcontentloaded' });
    if (!res || res.status() >= 500 || p.url().includes('/login')) bad.push(`${r} → ${res ? res.status() : 'no reply'}${p.url().includes('/login') ? ' (sent to login)' : ''}`);
  };
  for (const r of routes) await visit(r);
  ok(bad.length === 0, `${routes.length} admin pages open` + (bad.length ? ': ' + bad.join(', ') : ''));
  // Records behind the lists (dynamic routes: /orders/[id], its report / receipt / label, /patients/[id] …)
  const detail = [];
  for (const [list, re] of [['/orders', /^\/orders\/[0-9a-f-]{36}$/], ['/patients', /^\/patients\/[0-9a-f-]{36}$/],
    ['/invoices', /^\/invoices\/[0-9a-f-]{36}$/], ['/inventory', /^\/inventory\/[0-9a-f-]{36}$/], ['/purchase-orders', /^\/purchase-orders\/[0-9a-f-]{36}$/]]) {
    await p.goto(B + list);
    const href = (await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))).find((h) => re.test(h || ''));
    if (href) detail.push(href);
    if (href && list === '/orders') detail.push(href + '/report', href + '/receipt', href + '/label');
  }
  bad.length = 0;
  for (const r of detail) await visit(r);
  ok(detail.length >= 2 && bad.length === 0, `${detail.length} record pages open (${detail.map((d) => d.split('/')[1]).join(', ')})` + (bad.length ? ': ' + bad.join(', ') : ''));
  // Saving still works (server actions): a new patient appears in the list and opens.
  const name = 'مريض فحص الترقية ' + Date.now().toString().slice(-5);
  await p.goto(B + '/patients/new');
  await p.fill('input[name="full_name"]', name); await p.fill('input[name="age_years"]', '40'); await p.fill('input[name="phone"]', '07712345678');
  await p.click('button:has-text("حفظ المريض")'); await p.waitForTimeout(2500);
  await p.goto(B + '/patients?q=' + encodeURIComponent(name));
  const link = p.locator('a', { hasText: name }).first();
  ok(await link.count() === 1, 'new patient saved and listed');
  let patientId = '';
  if (await link.count()) { await link.click(); await p.waitForTimeout(1200); patientId = new URL(p.url()).pathname.split('/').pop(); ok((await p.locator('body').innerText()).includes(name), 'patient page opens'); }

  // The lab's own name and logo (Settings → «هوية المختبر»): on the panel, the report, the receipt
  // and the sign-in page; then back to the defaults.
  const LAB = 'مختبر النور التخصصي';
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGOI0mr6D8IMMAYARDgIFbiRq5wAAAAASUVORK5CYII=', 'base64');
  await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="identity-form"]', { timeout: 15000 });
  await p.fill('[data-testid="identity-form"] input[name="name"]', LAB);
  await p.click('[data-testid="identity-form"] button:has-text("حفظ")'); await p.waitForTimeout(1500);
  await p.setInputFiles('input[aria-label="ملف الشعار"]', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForSelector('[data-testid="logo-msg"]:has-text("حُفظ الشعار")', { timeout: 15000 });
  await p.reload(); await p.waitForSelector('[data-testid="lab-name"]', { timeout: 15000 });
  ok((await p.locator('[data-testid="lab-name"]').innerText()).includes(LAB), 'panel: the lab\'s own name in the side menu');
  ok(((await p.locator('[data-testid="lab-mark"]').first().getAttribute('src')) || '').startsWith('data:image/'), 'panel: its own logo');
  ok(((await p.locator('[data-testid="logo-preview"]').getAttribute('src')) || '').startsWith('data:image/'), 'Settings: the logo preview');
  let order = detail.find((h) => /^\/orders\/[0-9a-f-]{36}$/.test(h));
  if (!order && patientId) {
    // A fresh database has no orders: add the default tests if the catalog is empty, then an order
    // for the patient made above.
    await p.goto(B + '/orders/new?patient=' + patientId); await p.waitForTimeout(1200);
    if (await p.locator('text=لا فحوصات مطابقة').count()) {
      await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="import-tests-card"]', { timeout: 15000 });
      await p.click('button:has-text("استيراد قائمة الفحوصات الافتراضية")');
      await p.waitForSelector('[data-testid="import-tests-msg"]', { timeout: 30000 });
      await p.goto(B + '/orders/new?patient=' + patientId); await p.waitForTimeout(1200);
    }
    await p.locator('button', { hasText: /د\.ع|بدون سعر/ }).first().click();
    await p.click('button:has-text("إرسال الطلب للمختبر")');
    await p.waitForURL((u) => /^\/orders\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 20000 }).catch(() => {});
    const made = new URL(p.url()).pathname;
    if (/^\/orders\/[0-9a-f-]{36}$/.test(made)) order = made;
  }
  if (order) {
    await p.goto(B + order + '/report'); await p.waitForSelector('#report-sheet', { timeout: 15000 });
    const sheet = p.locator('#report-sheet');
    ok((await sheet.locator('h1').innerText()).includes(LAB) && ((await sheet.locator('img').nth(1).getAttribute('src')) || '').startsWith('data:image/'), 'report: the lab\'s name and logo');
    await p.goto(B + order + '/receipt'); await p.waitForSelector('#report-sheet', { timeout: 15000 });
    ok((await p.locator('#report-sheet').innerText()).includes(LAB), 'receipt: the lab\'s name');

    // The report's look (Settings → «شكل تقرير النتائج»): colours, signature and stamp, English.
    const color = (loc) => loc.first().evaluate((e) => getComputedStyle(e).color);
    await p.goto(B + order + '/report'); await p.waitForSelector('#report-sheet', { timeout: 15000 });
    ok(await color(p.locator('#report-sheet h1')) === 'rgb(90, 42, 130)' && await p.locator('[data-testid="report-signature"]').count() === 0, 'report: the original purple, the empty signature box');
    await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="report-look"]', { timeout: 15000 });
    const look = p.locator('[data-testid="report-look"]');
    await look.locator('button[aria-label="أزرق طبي"]').click();
    await look.locator('input[aria-label="التوقيع والختم على التقرير"]').check();
    await look.locator('input[aria-label="اسم المسؤول"]').fill('د. سارة محمود');
    await look.locator('input[aria-label="الصفة"]').fill('أخصائية تحليلات مرضية');
    await look.locator('input[aria-label="اسم المختبر بالإنجليزية"]').fill('Al-Noor Specialist Lab');
    await look.locator('button:has-text("حفظ شكل التقرير")').click();
    await p.waitForSelector('[data-testid="look-msg"]:has-text("حُفظ")', { timeout: 15000 });
    await look.locator('input[aria-label="ملف صورة التوقيع"]').setInputFiles({ name: 'sign.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForSelector('[data-testid="look-signature-preview"]', { timeout: 15000 });
    await look.locator('input[aria-label="ملف صورة الختم"]').setInputFiles({ name: 'stamp.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForSelector('[data-testid="look-stamp-preview"]', { timeout: 15000 });
    ok(true, 'Settings: colours, signature details, signature and stamp images saved');
    await p.goto(B + order + '/report'); await p.waitForSelector('#report-sheet', { timeout: 15000 });
    ok(await color(p.locator('#report-sheet h1')) === 'rgb(30, 79, 145)', 'report: the lab\'s colour');
    const sig = p.locator('[data-testid="report-signature"]');
    ok((await sig.innerText()).includes('د. سارة محمود') && (await sig.innerText()).includes('أخصائية تحليلات مرضية')
      && ((await sig.locator('img').first().getAttribute('src')) || '').startsWith('data:image/') && await p.locator('[data-testid="report-stamp"]').count() === 1, 'report: the signature, name, title and stamp');
    ok(await p.locator('#report-sheet[dir="rtl"]').count() === 1, 'report opens in Arabic');
    await p.locator('[data-testid="report-lang"] a:has-text("English")').click();
    await p.waitForSelector('#report-sheet[dir="ltr"]', { timeout: 15000 });
    const enText = await p.locator('#report-sheet').innerText();
    ok((await p.locator('#report-sheet h1').innerText()).includes('Al-Noor Specialist Lab') && enText.includes('Patient') && enText.includes('Reference range') && enText.includes('Verification code'), 'English report: the English name and headings');
    await p.goto(B + order + '/receipt'); await p.waitForSelector('#report-sheet', { timeout: 15000 });
    ok(await color(p.locator('#report-sheet .text-base.font-bold')) === 'rgb(30, 79, 145)', 'receipt: the lab\'s colour');
    // Back to the original look.
    await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="report-look"]', { timeout: 15000 });
    await look.locator('button[aria-label="إزالة صورة التوقيع"]').click(); await p.waitForSelector('[data-testid="look-signature-preview"]', { state: 'detached', timeout: 15000 });
    await look.locator('button[aria-label="إزالة صورة الختم"]').click(); await p.waitForSelector('[data-testid="look-stamp-preview"]', { state: 'detached', timeout: 15000 });
    await look.locator('button:has-text("الألوان الأصلية")').click();
    await look.locator('input[aria-label="التوقيع والختم على التقرير"]').uncheck();
    await look.locator('input[aria-label="اسم المختبر بالإنجليزية"]').fill('');
    await look.locator('button:has-text("حفظ شكل التقرير")').click();
    await p.waitForSelector('[data-testid="look-msg"]:has-text("حُفظ")', { timeout: 15000 });
    await p.goto(B + order + '/report'); await p.waitForSelector('#report-sheet', { timeout: 15000 });
    ok(await color(p.locator('#report-sheet h1')) === 'rgb(90, 42, 130)' && await p.locator('[data-testid="report-signature"]').count() === 0, 'back to the original report look');
  } else ok(false, 'no order to open a report for');
  const lctx = await b.newContext(); const lp = await lctx.newPage();
  await lp.goto(B + '/login'); await lp.waitForSelector('[data-testid="login-lab-name"]', { timeout: 15000 });
  ok((await lp.locator('[data-testid="login-lab-name"]').innerText()).includes(LAB), 'sign-in page: the lab\'s name');
  await lctx.close();
  // Back to the defaults.
  await p.goto(B + '/settings'); await p.waitForSelector('[data-testid="identity-form"]', { timeout: 15000 });
  await p.fill('[data-testid="identity-form"] input[name="name"]', '');
  await p.click('[data-testid="identity-form"] button:has-text("حفظ")'); await p.waitForTimeout(1500);
  await p.click('button:has-text("الشعار الافتراضي")');
  await p.waitForSelector('[data-testid="logo-msg"]:has-text("الشعار الافتراضي")', { timeout: 15000 });
  await p.reload(); await p.waitForSelector('[data-testid="lab-name"]', { timeout: 15000 });
  ok((await p.locator('[data-testid="lab-name"]').innerText()).includes('مختبر التحليلات المرضية') && await p.locator('[data-testid="lab-mark"]').count() === 0, 'back to the default name and mark');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
