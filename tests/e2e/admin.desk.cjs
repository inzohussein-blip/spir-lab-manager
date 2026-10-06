// «نافذة ساحب الدم» and «نافذة المختبر» in the full admin panel: the collector registers a patient and
// tests at their prices (discount, part payment, receipt), the lab receives the sample, enters results
// like the lab station (flags, previous result), reports a critical value before verifying, a second
// verification by another person, a sample entered at the lab without prices, delivery and the
// patient's WhatsApp notice; the collector sees only his window.
const { B, ok, launch, done } = require('./lib.cjs');
const TAG = Date.now().toString(36).slice(-5);
(async () => {
  const b = await launch();
  const errs = [];
  const num = (t) => Number(String(t).replace(/[^\d.-]/g, '')) || 0;
  const login = async (user, pass) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${user} ${p.url()} ${e.message.slice(0, 140)}`));
    p.on('dialog', (d) => d.accept());
    await p.goto(B + '/login');
    await p.fill('input[name="username"]', user); await p.fill('input[name="password"]', pass);
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    return p;
  };
  const toast = (p) => p.locator('[data-sonner-toast]').allInnerTexts().then((x) => x.join(' | ')).catch(() => '');

  // ── The manager: a collector and a technician, and a critical limit for WBC ──
  const a = await login('admin', 'admin123');
  for (const [href, label] of [['/collect', 'نافذة ساحب الدم'], ['/lab', 'نافذة المختبر']]) {
    ok(await a.locator(`aside a[href="${href}"]:has-text("${label}")`).count() === 1, `menu: «${label}»`);
  }
  ok(await a.locator('header a[href="/welcome"][data-testid="admin-home"]').count() === 1 && await a.locator('aside a[href="/welcome"]').count() === 1, '«الصفحة الرئيسية» in the top bar and the side menu');
  await a.click('[data-testid="admin-home"]');
  ok(await a.waitForURL((u) => u.pathname === '/welcome', { timeout: 20000 }).then(() => true, () => false), '…it opens the welcome page');
  const addUser = async (username, name, role) => {
    await a.goto(B + '/users');
    await a.fill('input[name="full_name"]', name); await a.fill('input[name="username"]', username); await a.fill('input[name="password"]', 'pass1234');
    await a.selectOption('select[name="role"]', role);
    await a.click('form button:has-text("إضافة")'); await a.waitForTimeout(800);
  };
  await addUser('col' + TAG, 'ساحب ' + TAG, 'collector');
  await addUser('tec' + TAG, 'فني ' + TAG, 'technician');
  await a.goto(B + '/users');
  ok((await a.locator(`tr:has-text("col${TAG}")`).innerText()).includes('ساحب الدم') || await a.locator(`tr:has-text("col${TAG}") select`).inputValue() === 'collector', 'a «ساحب الدم» account');
  await a.goto(B + '/tests');
  const wbcRow = a.locator('tr', { hasText: 'كريات الدم البيضاء' }).first();
  await wbcRow.locator('[data-testid="test-limits"]').click();
  await wbcRow.locator('input[name="critical_high"]').fill('30');
  await wbcRow.locator('button[aria-label="حفظ القيم الحرجة"]').click(); await a.waitForTimeout(1000);
  await a.reload();
  ok((await a.locator('tr', { hasText: 'كريات الدم البيضاء' }).first().locator('[data-testid="test-limits"]').innerText()).includes('> 30'), 'catalog: a critical limit for WBC (> 30)');

  // ── The collector ──
  const c = await login('col' + TAG, 'pass1234');
  ok(new URL(c.url()).pathname === '/collect', 'the collector starts at his window');
  ok(await c.locator('aside a[href]').evaluateAll((l) => l.map((x) => x.getAttribute('href')).filter((h) => h !== '/collect' && h !== '/welcome' && h.startsWith('/')).length) === 0, '…and his menu has only his window (and the home page)');
  await c.goto(B + '/patients');
  ok(await c.locator('text=لا تملك صلاحية الوصول').count() === 1, '…other pages are closed to him');
  await c.goto(B + '/'); await c.waitForURL((u) => u.pathname === '/collect', { timeout: 15000 });
  ok(true, '…and the home page leads back to his window');

  const pname = 'مراجعة الساحب ' + TAG;
  await c.fill('input[aria-label="اسم المراجع"]', pname);
  await c.selectOption('select[aria-label="الجنس"]', 'female');
  await c.fill('input[aria-label="العمر"]', '30');
  await c.fill('input[aria-label="الهاتف"]', '07701234567');
  await c.click('[data-testid="desk-test"]:has-text("الهيموغلوبين")');
  await c.click('[data-testid="desk-test"]:has-text("كريات الدم البيضاء")');
  const sub = num(await c.locator('[data-testid="collect-sub"]').innerText());
  ok(sub === 40, `the tests with their prices (${sub})`);
  await c.fill('input[aria-label="الخصم"]', '5');
  ok(num(await c.locator('[data-testid="collect-total"]').innerText()) === 35, 'a discount');
  await c.fill('input[aria-label="المدفوع"]', '20');
  await c.click('[data-testid="collect-save"]');
  await c.waitForSelector('[data-testid="collect-done"]', { timeout: 20000 });
  const acc = (await c.locator('[data-testid="collect-done"] .font-mono').innerText()).trim();
  ok(/^LAB-\d{8}-[0-9A-F]{4}$/.test(acc), `saved and sent to the lab (${acc})`);
  await c.click('[data-testid="collect-receipt"]');
  await c.waitForSelector('#report-sheet', { timeout: 20000 });
  ok(num(await c.locator('[data-testid="receipt-total"]').innerText()) === 35 && num(await c.locator('[data-testid="receipt-paid"]').innerText()) === 20
    && num(await c.locator('[data-testid="receipt-left"]').innerText()) === 15, 'the receipt: total 35, paid 20, 15 left');
  ok((await c.locator('#report-sheet').innerText()).includes(pname) && (await c.locator('#report-sheet').innerText()).includes('الخصم'), '…with the patient and the discount');
  await c.click('a:has-text("رجوع")'); await c.waitForURL((u) => u.pathname === '/collect');
  const row = c.locator('[data-testid="collect-row"]', { hasText: pname });
  ok((await row.innerText()).includes('بانتظار المختبر'), 'today\'s list: waiting for the lab');
  await row.locator('button:has-text("استلام الباقي")').click(); await c.waitForTimeout(1500);
  ok(!(await c.locator('[data-testid="collect-row"]', { hasText: pname }).innerText()).includes('باقي'), 'the rest paid');
  await a.goto(B + '/cashbox'); await a.waitForSelector('[data-testid="cashbox"]', { timeout: 20000 });
  ok((await a.locator('[data-testid="cashbox-in"]').allInnerTexts()).join(' ').includes(pname), 'the money is in the day\'s cash box');

  // ── The lab ──
  const t = await login('tec' + TAG, 'pass1234');
  await t.goto(B + '/lab'); await t.waitForSelector('[data-testid="lab-queue"]', { timeout: 20000 });
  ok(await t.locator('[data-testid="lab-settings"]').count() === 0, 'the lab\'s settings are the manager\'s');
  const q = t.locator('[data-testid="lab-queue-row"]', { hasText: pname });
  ok(await q.count() === 1 && (await q.innerText()).includes('ساحب الدم'), 'the collector\'s sample is waiting in the lab');
  await q.click(); await t.waitForSelector('[data-testid="lab-order"]', { timeout: 20000 });
  ok(!(await t.locator('[data-testid="lab-order"]').innerText()).includes('د.ع'), 'no prices in the lab');
  await t.click('[data-testid="lab-start"]'); await t.waitForTimeout(1200);
  ok((await t.locator('[data-testid="lab-status"]').innerText()).includes('قيد العمل'), 'received: in progress');
  await t.fill('input[aria-label="نتيجة الهيموغلوبين"]', '10');
  ok((await t.locator('[data-testid="lab-row"]', { hasText: 'الهيموغلوبين' }).locator('[data-testid="lab-flag"]').innerText()) === 'L', 'a low result flags L as it is typed');
  await t.fill('input[aria-label="نتيجة كريات الدم البيضاء"]', '35');
  ok(await t.locator('[data-testid="lab-critical-pill"]').count() === 1, 'a critical value shows at once');
  await t.click('[data-testid="lab-save"]');
  await t.waitForSelector('[data-testid="lab-critical"]', { timeout: 15000 });
  ok(true, 'saved: the critical value waits to be reported');
  await t.click('[data-testid="lab-verify"]'); await t.waitForTimeout(1500);
  ok((await t.locator('[data-testid="lab-status"]').innerText()).includes('قيد العمل') && (await toast(t)).includes('الحرجة'), 'it cannot be verified before the critical value is reported');
  await t.fill('[data-testid="lab-critical"] input[aria-label="من أُبلغ"]', 'د. سارة هاتفياً');
  await t.click('[data-testid="lab-critical"] button:has-text("سُجّل الإبلاغ")'); await t.waitForTimeout(1500);
  ok(await t.locator('[data-testid="lab-critical"]').count() === 0, 'the report of the critical value is recorded');
  await t.click('[data-testid="lab-verify"]'); await t.waitForTimeout(1500);
  ok((await t.locator('[data-testid="lab-status"]').innerText()).includes('معتمدة'), 'verified');
  ok(await t.locator('input[aria-label="نتيجة الهيموغلوبين"]').isDisabled(), '…and locked');
  const sheet = await t.locator('#report-sheet').innerText();
  ok(sheet.includes(pname) && sheet.includes(acc) && sheet.includes('10'), 'the printed report: the patient, sample number and results');
  await t.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
  await t.click('[data-testid="lab-notify"]');
  await t.waitForFunction(() => window.__opened.length > 0, null, { timeout: 15000 }).catch(() => undefined);
  const wa = await t.evaluate(() => window.__opened[0] || '');
  ok(wa.includes('wa.me/07701234567'), 'the patient\'s WhatsApp notice, on his number');
  ok(decodeURIComponent(wa).includes('/verify/'), '…the link that shows the report is genuine');

  // ── The collector hands the results over ──
  await c.reload();
  const row2 = c.locator('[data-testid="collect-row"]', { hasText: pname });
  ok((await row2.innerText()).includes('معتمدة'), 'the collector sees the results are ready');
  await row2.locator('button:has-text("تسليم النتيجة")').click(); await c.waitForTimeout(1500);
  ok((await c.locator('[data-testid="collect-row"]', { hasText: pname }).innerText()).includes('سُلّمت'), '…and delivers them');

  // ── Second verification (the manager switches it on) ──
  await a.goto(B + '/lab'); await a.click('[data-testid="lab-settings"]');
  await a.check('[data-testid="lab-settings-dialog"] input[aria-label="اعتماد ثانٍ"]');
  await a.check('[data-testid="lab-settings-dialog"] input[aria-label="ملصقات الأنابيب"]');
  await a.selectOption('[data-testid="lab-settings-dialog"] select[aria-label="الوقت"]', '24h');
  await a.click('[data-testid="lab-settings-save"]'); await a.waitForTimeout(1500);

  // A sample entered at the lab, without prices, for the same patient (found by name).
  await a.click('[data-testid="lab-new"]');
  ok(await a.locator('[data-testid="lab-new-dialog"] [data-testid="desk-test"] .tabular-nums').count() === 0, 'a new sample at the lab: tests without prices');
  await a.fill('[data-testid="lab-new-dialog"] input[aria-label="اسم المراجع"]', pname.slice(0, 12));
  await a.click(`[data-testid="desk-patient-hits"] button:has-text("${pname}")`);
  ok(await a.locator('[data-testid="desk-patient-picked"]').count() === 1, '…the patient found from the earlier visit');
  await a.click('[data-testid="lab-new-dialog"] [data-testid="desk-test"]:has-text("الهيموغلوبين")');
  await a.click('[data-testid="lab-new-save"]');
  await a.waitForSelector('[data-testid="lab-order"]', { timeout: 20000 });
  ok((await a.locator('[data-testid="lab-prev"]').innerText()).includes('10'), 'the previous result shows beside the new one');
  await a.fill('input[aria-label="نتيجة الهيموغلوبين"]', '13');
  ok((await a.locator('[data-testid="lab-prev"]').innerText()).includes('+3'), '…with the change');
  ok((await a.locator('#report-sheet').innerText()).match(/\d{2}:\d{2}/), 'the print options apply (the time on the report)');
  ok(await a.locator('button:has-text("ملصق الأنبوب")').count() === 1, '…tube labels switched on');
  await a.click('[data-testid="lab-verify"]'); await a.waitForTimeout(2000);
  ok((await a.locator('[data-testid="lab-status"]').innerText()).includes('بانتظار الاعتماد الثاني'), 'first verification: waiting for a second person');
  await a.click('[data-testid="lab-verify"]'); await a.waitForTimeout(1500);
  ok((await toast(a)).includes('شخص آخر'), '…not by the same person');
  const acc2 = (await a.locator('[data-testid="lab-order"] .font-mono').first().innerText()).trim();
  await t.goto(B + '/lab'); await t.waitForSelector('[data-testid="lab-scan"]');
  await t.fill('[data-testid="lab-scan"]', acc2); await t.press('[data-testid="lab-scan"]', 'Enter');
  await t.waitForSelector('[data-testid="lab-order"]', { timeout: 20000 });
  ok((await t.locator('[data-testid="lab-order"] .font-mono').first().innerText()).trim() === acc2, 'a sample opened by scanning its number');
  await t.click('[data-testid="lab-verify"]'); await t.waitForTimeout(1500);
  ok((await t.locator('[data-testid="lab-status"]').innerText()).includes('معتمدة'), 'the second person verifies it');
  // The manager reopens verified results.
  await a.reload(); await a.fill('[data-testid="lab-scan"]', acc2); await a.press('[data-testid="lab-scan"]', 'Enter');
  await a.waitForSelector('[data-testid="lab-reopen"]', { timeout: 20000 });
  await a.click('[data-testid="lab-reopen"]'); await a.waitForTimeout(1500);
  ok((await a.locator('[data-testid="lab-status"]').innerText()).includes('قيد العمل'), 'the manager reopens verified results');
  // Back to one verification for the other tests.
  await a.click('[data-testid="lab-settings"]');
  await a.uncheck('[data-testid="lab-settings-dialog"] input[aria-label="اعتماد ثانٍ"]');
  await a.click('[data-testid="lab-settings-save"]'); await a.waitForTimeout(1000);

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close();
  done('admin.desk');
})().catch((e) => { console.error(e); process.exit(1); });
