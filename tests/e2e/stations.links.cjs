// The stations on one computer work together (all but training): quality's control material comes
// from the stock room and uses a unit per control run, analyte names come from the lab's tests, the
// staff are offered as «المنفّذ», and procurement's suppliers as a device's supplier (with its phone).
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  const qty = async (name) => ((await kv(p, 'station.stock.v1')) || []).find((s) => s.name === name)?.qty;

  // Staff, a supplier and a control material, each in its own station.
  await p.goto(B + '/roster/staff'); await p.waitForSelector('label:has-text("الاسم *") input', { timeout: 20000 });
  await p.fill('label:has-text("الاسم *") input', 'موظف الربط'); await p.click('button:has-text("إضافة")'); await p.waitForTimeout(500);
  await p.goto(B + '/store/suppliers'); await p.waitForSelector('label:has-text("الاسم *") input', { timeout: 20000 });
  await p.fill('label:has-text("الاسم *") input', 'مورّد الأجهزة'); await p.fill('label:has-text("الهاتف") input', '07701112233');
  await p.click('button:has-text("إضافة")'); await p.waitForTimeout(500);
  await p.goto(B + '/store/inventory'); await p.waitForSelector('label:has-text("اسم الصنف") input', { timeout: 20000 });
  await p.fill('label:has-text("اسم الصنف") input', 'كنترول السكر'); await p.fill('input[aria-label="الكمية"]', '10');
  await p.click('button:has-text("إضافة")');
  ok(await settled(async () => (await qty('كنترول السكر')) === 10), 'control material in the stock room (10)');

  // The lab's tests are offered as analyte names (the lab station's catalog exists once it opened).
  await p.goto(B + '/station'); await p.waitForTimeout(1200);
  await p.goto(B + '/qc/analytes'); await p.waitForTimeout(1200);
  ok(await p.locator('datalist#lab-tests option').count() > 10, 'quality: the lab station\'s tests offered as names');
  await p.locator('select[aria-label^="مادة الكنترول في المخزن"]').first().selectOption({ label: 'كنترول السكر (10)' });
  await p.click('button:has-text("حفظ")');
  ok(await settled(async () => ((await kv(p, 'qc.analytes.v1')) || []).some((a) => a.stockId)), 'quality: an analyte linked to the stock item');
  await p.goto(B + '/store/inventory'); await p.waitForTimeout(1000);
  ok(await p.locator('[data-testid="qc-link"]').count() === 1, 'the stock room shows the item is used by quality');

  // A control run uses one unit; editing the same run does not use another.
  await p.goto(B + '/qc/entry'); await p.waitForTimeout(1200);
  ok(await p.locator('datalist#staff-names option[value="موظف الربط"]').count() === 1, 'quality: the staff offered as «المنفّذ»');
  ok((await p.locator('[data-testid="qc-stock"]').first().innerText()).includes('10'), 'quality: the material\'s stock shown on the entry screen');
  const v = p.locator('input[placeholder="القيمة"]').first();
  await v.fill('96'); await v.press('Tab');
  ok(await settled(async () => (await qty('كنترول السكر')) === 9), 'a control run uses one unit (10 → 9)');
  await v.fill('97'); await v.press('Tab'); await p.waitForTimeout(800);
  ok((await qty('كنترول السكر')) === 9, 'correcting the same run uses nothing more');

  // A device's supplier from procurement, with its phone.
  await p.goto(B + '/qc/devices'); await p.waitForTimeout(1200);
  await p.locator('button:has-text("تعديل")').first().click();
  await p.fill('input[aria-label="شركة الصيانة"]', 'مورّد الأجهزة');
  ok(await p.locator('datalist#supplier-names option[value="مورّد الأجهزة"]').count() === 1, 'quality: procurement\'s suppliers offered for a device');
  ok(await settled(async () => ((await kv(p, 'qc.devices.v1')) || []).some((d) => d.vendor === 'مورّد الأجهزة' && d.vendorPhone)), 'the supplier\'s phone comes along');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
