// The admin panel beyond the stations: daily QC with Westgard rules and the Levey-Jennings chart,
// temperatures, devices; staff attendance, leave, advances and payroll; a full stocktake, kits and the
// movement log; a test's reagent deducted when ordered; «رموز الأطباء» feeding the doctors' window;
// a lab station's backup imported; the side menu's counts and «يومي».
const fs = require('node:fs');
const { B, ok, launch, done, tmp } = require('./lib.cjs');
const TAG = Date.now().toString(36).slice(-5);
(async () => {
  const b = await launch();
  const errs = [];
  const num = (t) => Number(String(t).replace(/[^\d.-]/g, '')) || 0;
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'نُقلت العيّنات لثلاجة أخرى' : undefined));
  await p.goto(B + '/login');
  await p.fill('input[name="username"]', 'admin'); await p.fill('input[name="password"]', 'admin123');
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
  ok(await p.locator('[data-testid="my-day"]').count() === 1, '«يومي» on the manager\'s home page');

  // ── QC ──
  await p.goto(B + '/quality'); await p.waitForSelector('[data-testid="quality-board"]', { timeout: 20000 });
  await p.click('[data-testid="qtab-setup"]');
  await p.click('[data-testid="qc-add"]');
  await p.fill('input[aria-label="اسم التحليل"]', 'Glucose ' + TAG);
  await p.fill('input[aria-label="وحدة التحليل"]', 'mg/dL');
  await p.fill('input[aria-label="المتوسط 1"]', '100'); await p.fill('input[aria-label="SD 1"]', '5');
  await p.click('[data-testid="qc-save"]'); await p.waitForTimeout(1500);
  ok((await p.locator('[data-testid="qc-setup"]').innerText()).includes('Glucose ' + TAG), 'QC: a control with its level (100 ± 5)');
  await p.fill('input[aria-label="اسم الوحدة"]', 'ثلاجة الكواشف ' + TAG);
  await p.fill('input[aria-label="الحد الأدنى"]', '2'); await p.fill('input[aria-label="الحد الأعلى"]', '8');
  await p.click('[data-testid="temp-unit-add"]'); await p.waitForTimeout(1500);
  await p.click('[data-testid="qtab-today"]');
  const lv = p.locator('[data-testid="qc-level"]', { hasText: 'Level 1' }).filter({ has: p.locator(`input[aria-label="Glucose ${TAG} Level 1"]`) });
  await lv.locator('input').fill('118'); await lv.locator('input').press('Enter'); await p.waitForTimeout(1500);
  ok((await lv.locator('[data-testid="qc-status"]').innerText()).includes('1-3s'), 'Westgard: 118 (z 3.6) is rejected by 1-3s');
  await p.click('[data-testid="qtab-chart"]');
  await p.selectOption('select[aria-label="التحليل"]', { label: 'Glucose ' + TAG });
  ok(await p.locator('[data-testid="qc-chart"] svg circle').count() >= 1, 'the Levey-Jennings chart shows the value');
  await p.click('[data-testid="qtab-temps"]');
  const temp = p.locator(`input[aria-label^="ثلاجة الكواشف ${TAG}"][aria-label$="AM"]`).first();
  await temp.fill('11'); await temp.blur(); await p.waitForTimeout(1500);
  ok((await p.locator(`input[aria-label^="ثلاجة الكواشف ${TAG}"][aria-label$="AM"]`).first().getAttribute('class')).includes('red'), 'temperatures: a reading out of range is marked (with its action)');
  await p.click('[data-testid="qtab-devices"]');
  await p.click('[data-testid="device-add"]');
  await p.fill('input[aria-label="اسم الجهاز"]', 'محلل ' + TAG);
  await p.click('[data-testid="device-form"] button:has-text("+ مهمة")');
  await p.fill('[data-testid="device-form"] input[aria-label="المهمة"]', 'تنظيف الإبرة');
  await p.click('[data-testid="device-save"]'); await p.waitForTimeout(1500);
  const dev = p.locator('[data-testid="device"]', { hasText: 'محلل ' + TAG });
  await dev.locator('[data-testid="device-task"] button:has-text("تم")').click(); await p.waitForTimeout(1500);
  ok(await p.locator('[data-testid="device"]', { hasText: 'محلل ' + TAG }).locator('[data-testid="device-task"] button').count() === 0, 'devices: a daily task done');
  await dev.locator('input[aria-label="وصف السجل"]').fill('توقف المضخة');
  await dev.locator('button:has-text("تسجيل")').click(); await p.waitForTimeout(1500);
  ok(await p.locator('[data-testid="device"]', { hasText: 'محلل ' + TAG }).locator('[data-testid="device-fault"]').count() === 1, '…a fault recorded and open');
  await p.goto(B + '/lab');
  ok(await p.locator('aside a[href="/quality"] [data-testid="nav-badge"]').count() === 1, 'the side menu counts the open fault');

  // ── Staff ──
  const who = 'موظف ' + TAG;
  await p.goto(B + '/staff');
  await p.fill('input[name="full_name"]', who); await p.click('button:has-text("إضافة موظف")'); await p.waitForTimeout(1000);
  await p.fill(`input[aria-label="راتب ${who}"]`, '600000');
  await p.locator('tr', { hasText: who }).locator('button:has-text("حفظ")').click(); await p.waitForTimeout(1000);
  await p.goto(B + '/staff/attendance');
  const arow = p.locator('[data-testid="attendance-row"]', { hasText: who });
  await arow.locator('button:has-text("حضور")').click(); await p.waitForTimeout(1000);
  await p.locator('[data-testid="attendance-row"]', { hasText: who }).locator('button:has-text("انصراف")').click(); await p.waitForTimeout(1000);
  ok(/\d{2}:\d{2}.*\d{2}:\d{2}/s.test(await p.locator('[data-testid="attendance-row"]', { hasText: who }).innerText()), 'attendance: check-in and check-out times');
  const yesterday = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA'); });
  const month = yesterday.slice(0, 7);
  await p.goto(B + '/staff/attendance?date=' + yesterday);
  await p.locator('[data-testid="attendance-row"]', { hasText: who }).locator('button:has-text("غائب")').click(); await p.waitForTimeout(1000);
  await p.goto(B + '/staff/leaves');
  await p.selectOption('[data-testid="advance-form"] select[name="staff_id"]', { label: who });
  await p.fill('[data-testid="advance-form"] input[name="amount"]', '50000');
  await p.fill('[data-testid="advance-form"] input[name="given_on"]', yesterday);
  await p.click('[data-testid="advance-form"] button:has-text("تسجيل السلفة")'); await p.waitForTimeout(1000);
  ok(await p.locator('[data-testid="advance-row"]', { hasText: who }).count() === 1, 'an advance recorded');
  await p.goto(B + '/staff/payroll?month=' + month);
  // 600000 − one absent day (600000 ÷ 30 = 20000) − 50000 advance = 530000 (more if today's attendance falls in another month — no).
  ok(num(await p.locator('[data-testid="payroll-row"]', { hasText: who }).locator('[data-testid="payroll-net"]').innerText()) === 530000, 'payroll: salary − absence − advance = 530,000');

  // ── Stock: kit, reagent per test, stocktake, moves ──
  const item = 'كاشف السكر ' + TAG;
  await p.goto(B + '/inventory');
  await p.fill('input[name="name"]', item); await p.fill('input[name="quantity"]', '10'); await p.fill('input[name="min_quantity"]', '2');
  await p.click('form button:has-text("إضافة")'); await p.waitForTimeout(1000);
  await p.goto(B + '/inventory/kits');
  await p.fill('[data-testid="kit-form"] input[name="name"]', 'علبة 100 ' + TAG);
  await p.selectOption('[data-testid="kit-form"] select[name="product_id"]', { label: item });
  await p.fill('[data-testid="kit-form"] input[name="units"]', '100');
  await p.click('[data-testid="kit-form"] button'); await p.waitForTimeout(1000);
  const kit = p.locator('[data-testid="kit-row"]', { hasText: 'علبة 100 ' + TAG });
  await kit.locator('input[name="count"]').fill('2'); await kit.locator('button:has-text("استلام")').click(); await p.waitForTimeout(1000);
  ok((await p.locator('[data-testid="kit-row"]', { hasText: 'علبة 100 ' + TAG }).innerText()).includes('الرصيد 210'), 'kits: two boxes of 100 received (10 → 210)');
  await p.goto(B + '/tests');
  const glu = p.locator('tr', { hasText: 'سكر صائم' }).first();
  await glu.locator('select[name="product_id"]').selectOption({ label: item });
  await glu.locator('input[name="qty"]').fill('1');
  await glu.locator('[data-testid="test-reagent"] button').click(); await p.waitForTimeout(1000);
  // An order with the test deducts one unit.
  await p.goto(B + '/lab'); await p.click('[data-testid="lab-new"]');
  await p.fill('[data-testid="lab-new-dialog"] input[aria-label="اسم المراجع"]', 'مراجع المخزون ' + TAG);
  await p.click('[data-testid="lab-new-dialog"] [data-testid="desk-test"]:has-text("سكر صائم")');
  await p.click('[data-testid="lab-new-save"]'); await p.waitForSelector('[data-testid="lab-order"]', { timeout: 20000 });
  await p.goto(B + '/inventory/count');
  const crow = p.locator('[data-testid="stocktake"] tr', { hasText: item });
  ok((await crow.innerText()).includes('209'), 'a test ordered deducts its reagent (210 → 209)');
  await crow.locator('input').fill('200');
  await p.click('button:has-text("حفظ الجرد")'); await p.waitForTimeout(1500);
  ok((await p.locator('[data-testid="stock-counts"]').innerText()).includes('1 فرق'), 'stocktake: counted 200, one difference kept');
  await p.goto(B + '/inventory/moves');
  const moves = await p.locator('[data-testid="moves"]').innerText();
  ok(moves.includes('-9') && moves.includes('+200') && moves.includes('جرد') && moves.includes('استلام عبوات'), 'the movement log: kits, the test, the stocktake');

  // ── «رموز الأطباء» from the admin panel ──
  const docName = 'د. رمز ' + TAG;
  await p.goto(B + '/referrers');
  await p.fill('input[name="name"]', docName); await p.click('form button:has-text("إضافة")'); await p.waitForTimeout(1000);
  // A verified result for him.
  await p.goto(B + '/collect');
  await p.fill('input[aria-label="اسم المراجع"]', 'مراجع الطبيب ' + TAG);
  await p.selectOption('select[aria-label="الطبيب المحيل"]', { label: docName });
  await p.click('[data-testid="desk-test"]:has-text("الهيموغلوبين")');
  await p.click('[data-testid="collect-save"]'); await p.waitForSelector('[data-testid="collect-done"]', { timeout: 20000 });
  const acc = (await p.locator('[data-testid="collect-done"] .font-mono').innerText()).trim();
  await p.goto(B + '/lab'); await p.fill('[data-testid="lab-scan"]', acc); await p.press('[data-testid="lab-scan"]', 'Enter');
  await p.waitForSelector('[data-testid="lab-order"]', { timeout: 20000 });
  await p.fill('input[aria-label="نتيجة الهيموغلوبين"]', '14');
  await p.click('[data-testid="lab-verify"]'); await p.waitForTimeout(2500);
  await p.goto(B + '/referrers/codes');
  await p.locator('[data-testid="doctor-code-row"]', { hasText: docName }).locator('[data-testid="doctor-code-create"]').click();
  await p.waitForSelector('[data-testid="doctor-code-value"]', { timeout: 20000 });
  const code = (await p.locator('[data-testid="doctor-code-value"]').innerText()).trim();
  ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), 'a doctor\'s code made in the admin panel');
  const d = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  d.on('pageerror', (e) => errs.push(`doctor ${e.message.slice(0, 140)}`));
  await d.goto(B + '/doctor'); await d.waitForSelector('[data-testid="doctor-gate"]', { timeout: 30000 });
  await d.fill('[data-testid="doctor-gate"] input[aria-label="رمز التفعيل"]', code); await d.click('[data-testid="doctor-gate"] button:has-text("تفعيل")');
  await d.waitForSelector('[data-testid="doctor-visit"]', { timeout: 30000 });
  ok((await d.locator('[data-testid="doctor-visit"]').first().innerText()).includes('مراجع الطبيب ' + TAG), 'the doctor opens his window with it and sees the verified result');

  // ── A lab station's backup imported ──
  const file = tmp('station-' + TAG + '.json');
  fs.writeFileSync(file, JSON.stringify({
    app: 'spir-lab-station', version: 1, exported_at: new Date().toISOString(),
    tests: [{ id: 't1', code: 'HGB', name_ar: 'الهيموغلوبين', unit: 'g/dL', normal: { kind: 'numeric', low: 12, high: 16 } },
      { id: 't2', name_ar: 'فحص محطة ' + TAG, unit: 'U/L', normal: { kind: 'numeric', low: 1, high: 5 } }],
    visits: [{ id: 'v-' + TAG, created_at: Date.now() - 86400000, accession: 'ST-' + TAG, patient: { name: 'مراجع المحطة ' + TAG, gender: 'male', age: '40' }, referrer: 'د. المحطة ' + TAG,
      results: [{ testId: 't1', name_ar: 'الهيموغلوبين', value: '15' }, { testId: 't2', name_ar: 'فحص محطة', value: '9' }] }],
    pages: [], panels: [], settings: {},
  }));
  await p.goto(B + '/settings/import');
  await p.setInputFiles('input[aria-label="ملف النسخة الاحتياطية"]', file);
  await p.waitForSelector('[data-testid="station-import-file"]');
  await p.click('[data-testid="station-import-run"]');
  await p.waitForFunction(() => /استُورد 1/.test(document.querySelector('[data-testid="station-import-progress"]')?.textContent || ''), null, { timeout: 30000 });
  ok((await p.locator('[data-testid="station-import-progress"]').innerText()).includes('أُضيف 1'), 'station import: the visit, and its new test added to the catalog');
  await p.click('[data-testid="station-import-run"]');
  await p.waitForFunction(() => /تُخطّي 1/.test(document.querySelector('[data-testid="station-import-progress"]')?.textContent || ''), null, { timeout: 30000 });
  ok(true, '…imported again: skipped, not doubled');
  await p.goto(B + '/orders?q=' + encodeURIComponent('مراجع المحطة ' + TAG));
  ok((await p.locator('body').innerText()).includes('مراجع المحطة ' + TAG), 'the imported visit is in the sample log');

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close();
  done('admin.ops');
})().catch((e) => { console.error(e); process.exit(1); });
