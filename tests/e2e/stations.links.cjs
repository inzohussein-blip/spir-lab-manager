// The stations on one computer work together (all but training): quality's control material comes
// from the stock room and uses a unit per control run, analyte names come from the lab's tests, the
// staff are offered as «المنفّذ», and procurement's suppliers as a device's supplier (with its phone).
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
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
  await p.goto(B + '/store/items'); await p.waitForSelector('[data-testid="item-new"]', { timeout: 20000 }); await p.click('[data-testid="item-new"]');
  await p.fill('[data-testid="item-form"] label:has-text("اسم الصنف") input', 'كنترول السكر'); await p.fill('[data-testid="item-form"] input[aria-label="الكمية"]', '10');
  await p.click('[data-testid="item-form"] button[type=submit]');
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

  // The stock room knows the lab's tests: a reagent can serve several tests (one per test, taken with
  // the results); tubes, syringes and other supplies are issued by the examiner (one may serve many tests).
  await p.goto(B + '/store/items'); await p.waitForSelector('[data-testid="stock-presets"]', { timeout: 20000 });
  await p.click('[data-testid="stock-presets"]');
  const edta = await settled(async () => ((await kv(p, 'station.stock.v1')) || []).find((s) => s.name.startsWith('أنبوب EDTA')));
  ok(!!edta, 'common supplies added to the stock room');
  ok(((await kv(p, 'station.stock.v1')) || []).filter((s) => ['سرنجة سحب دم', 'قفازات'].includes(s.name) && s.byHand).length === 2, 'with the syringe and other materials (gloves…), issued by hand');
  const cat = await kv(p, 'station.tests.v1');
  const hb = cat.find((t) => t.code === 'HB').id, wbc = cat.find((t) => t.code === 'WBC').id;
  const stock = (await kv(p, 'station.stock.v1')).map((s) => (s.name.startsWith('أنبوب EDTA') ? { ...s, qty: 10 } : s));
  ok(stock.find((s) => s.name.startsWith('أنبوب EDTA')).byHand && stock.find((s) => s.name.startsWith('أنبوب EDTA')).testIds.includes(hb), 'EDTA tube shown with the blood count tests, issued by the examiner');
  await kvPut(p, 'station.stock.v1', [...stock, { id: 'reagent-cbc', name: 'كاشف CBC', qty: 10, testIds: [hb, wbc] }]);
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض المخزن');
  for (const q of ['Hemoglobin', 'White Blood']) { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(150); await p.locator('div.grid button:has(span.flex-1)').first().click(); }
  await p.click('button[title="حفظ (Ctrl+S)"]');
  const after = async () => { const s = (await kv(p, 'station.stock.v1')) || []; return [s.find((x) => x.name.startsWith('أنبوب EDTA'))?.qty, s.find((x) => x.id === 'reagent-cbc')?.qty]; };
  ok(await settled(async () => (await after())[1] === 8), `a visit with Hb + WBC: one reagent per test (10 → 8)`);
  ok((await after())[0] === 10, `the tube is left to the examiner (still 10) — got ${JSON.stringify(await after())}`);
  await p.goto(B + '/store/inventory'); await p.waitForTimeout(1000);
  ok((await p.locator('tr[data-stock="كاشف CBC"] [data-testid="stock-tests"]').innerText()).includes('2 فحص'), 'the stock room shows the linked tests');

  // The side menu folds with the small mark at its top, stays folded in every station, and opens again.
  await p.goto(B + '/station'); await p.waitForSelector('[data-testid="side-collapse"]', { timeout: 20000 });
  await p.click('[data-testid="side-collapse"]');
  ok(await p.locator('aside').isHidden() && await p.locator('[data-testid="side-reopen"]').isVisible(), 'side menu folded');
  await p.goto(B + '/qc'); await p.waitForSelector('[data-testid="side-reopen"]', { timeout: 20000 });
  ok(await p.locator('aside').isHidden(), 'and stays folded in the other stations');
  await p.click('[data-testid="side-reopen"]');
  ok(await p.locator('aside').isVisible() && await p.locator('[data-testid="side-reopen"]').count() === 0, 'opened again');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
