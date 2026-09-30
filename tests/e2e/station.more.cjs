// Lab requests: the sample barcode can be hidden from the report, «تمييز» inside the urine / stool /
// semen / culture forms, «المخزن والمشتريات» as the station's name, the stock room's out-of-stock
// warning and negative stock (one choice, set from either station), and the regrouped settings.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  const sw = (label) => p.locator(`label:has(span:text-is("${label}"))`).locator('button[role=switch]');

  // ── The station's new name ──
  await p.goto(B + '/welcome'); await p.waitForTimeout(800);
  ok(await p.locator('text=المخزن والمشتريات').count() >= 1 && await p.locator('text=منظومة المشتريات').count() === 0, 'welcome: «المخزن والمشتريات»');
  await p.goto(B + '/store'); await p.waitForSelector('aside', { timeout: 20000 });
  ok((await p.locator('aside').innerText()).includes('المخزن والمشتريات') && (await p.locator('h1').first().innerText()).includes('المخزن والمشتريات'), 'the station and its page carry the new name');

  // ── Lab station settings, regrouped ──
  await p.goto(B + '/station'); await p.waitForTimeout(1200); // the catalog exists once the station opened
  await p.goto(B + '/station/settings#lab'); await p.waitForSelector('[data-testid="settings-nav"]', { timeout: 20000 });
  const ids = await p.locator('[data-testid="settings-nav"] button[data-section]').evaluateAll((bs) => bs.map((x) => x.dataset.section));
  ok(JSON.stringify(ids) === JSON.stringify(['lab', 'report', 'forms', 'entry', 'stock', 'tests', 'device', 'look']), `sections: ${ids.join(', ')}`);
  ok(await p.locator('[data-sec="lab"] [data-testid="lab-identity"]').count() === 1 && await p.locator('[data-sec="lab"] [data-testid="lab-contact"]').count() === 1, '«المختبر»: name and logo, contact details');
  ok(await p.locator('[data-sec="look"] [data-testid="pin-card"]').count() === 1 && await p.locator('[data-sec="device"] [data-testid="pin-card"]').count() === 0, 'PIN under «الأمان والمظهر»');
  for (const st of ['qc', 'roster', 'training', 'store']) {
    await p.goto(B + `/${st}/settings#look`); await p.waitForSelector('[data-sec="look"] [data-testid="pin-card"]', { timeout: 20000 });
  }
  ok(true, 'every station: «الأمان والمظهر» with the PIN');

  // ── The sample barcode on the report: shown by default, can be hidden ──
  await p.goto(B + '/station/settings#report'); await p.waitForSelector('[data-testid="settings-preview"] .report-pbc', { timeout: 20000 });
  const pbc = () => p.locator('[data-testid="settings-preview"] .report-pbc').evaluate((e) => ({ n: e.children.length, text: e.innerText }));
  ok(await settled(async () => (await pbc()).n === 2), 'barcode and sample number on the report');
  await sw('باركود رقم العينة بجانب معلومات المريض').click();
  ok(await settled(async () => (await kv(p, 'station.settings.v1'))?.reportBarcode === false), 'barcode switched off');
  const off = await pbc();
  ok(off.n === 1 && off.text.includes('LAB-PREVIEW-001'), 'no barcode — the sample number stays');
  await sw('باركود رقم العينة بجانب معلومات المريض').click();

  // ── «تمييز» inside the forms ──
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض تمييز الاستمارة');
  const pick = async (q) => { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(120); await p.locator('div.grid button:has(span.flex-1)').first().click(); };
  for (const q of ['General Urine', 'Culture & Sensitivity']) await pick(q);
  await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  const card = (name) => p.locator('div.group.rounded-xl', { hasText: name });
  const dlg = p.locator('div[role=dialog]');
  const choose = async (label, option) => { await dlg.locator(`input[aria-label="${label}"]`).click(); await dlg.locator(`li button:has-text("${option}")`).first().click(); };
  await card('فحص الإدرار العام').locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  await choose('Color', 'Dark Yellow'); await choose('Sugar (Glucose)', '++');
  await dlg.locator('input[aria-label="تمييز Sugar (Glucose)"]').check();
  await dlg.locator('button:has-text("تم")').click();
  ok((await card('فحص الإدرار العام').locator('[data-testid="form-hl"]').innerText()).includes('1'), 'urine: one field ticked (shown on the test)');
  await card('الزرع والحساسية').locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  await choose('Specimen', 'Urine'); await choose('Culture', 'Significant bacterial growth'); await choose('Organism', 'Klebsiella spp.');
  await dlg.locator('button[aria-label="Amikacin H.S"]').click(); await dlg.locator('button[aria-label="Aztreonam R"]').click();
  await dlg.locator('input[aria-label="تمييز Culture Result"]').check();
  await dlg.locator('input[aria-label="تمييز Aztreonam"]').check();
  await dlg.locator('button:has-text("تم")').click();
  const sheet = p.locator('#report-sheet');
  const hlRows = async () => sheet.locator('[data-hl="1"]').evaluateAll((xs) => xs.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  let rows = await hlRows();
  ok(rows.some((t) => t.startsWith('Sugar (Glucose)') && t.includes('++')) && await sheet.locator('tr[data-hl="1"] mark').count() === 1, `urine: the ticked field highlighted on the report (${rows.join(' | ')})`);
  ok(rows.some((t) => t.includes('Culture:') && t.includes('Klebsiella')) && rows.some((t) => t === 'Aztreonam'), 'culture: the culture line and the ticked antibiotic highlighted');
  ok(!rows.some((t) => t.startsWith('Color')), 'fields not ticked stay plain');
  await p.keyboard.press('Control+s'); await p.waitForTimeout(600);
  const vid = (await kv(p, 'station.visits.v1'))[0].id;
  await p.goto(B + '/station?edit=' + vid); await p.waitForSelector('#report-sheet', { timeout: 20000 }); await p.waitForTimeout(600);
  rows = await hlRows();
  ok(rows.length === 3, `highlights kept after reopening the visit (${rows.length})`);

  // ── Stock room: out of stock (off by default) ──
  const cat = await kv(p, 'station.tests.v1');
  const hb = cat.find((t) => t.code === 'HB').id;
  await kvPut(p, 'station.stock.v1', [{ id: 'hb-reagent', name: 'كاشف الهيموغلوبين', qty: 0, testIds: [hb] }]);
  const hbVisit = async (name) => {
    await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(name);
    await pick('Hemoglobin'); await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  };
  await hbVisit('مريض المخزن 1');
  ok(await p.locator('[data-testid="stock-out"]').count() === 0, 'off by default: no out-of-stock note');
  await p.locator('[data-result-idx="0"]').fill('13'); await p.keyboard.press('Control+s'); await p.waitForTimeout(600);
  ok(((await kv(p, 'station.stock.v1'))[0].qty) === 0, 'off by default: the count stops at 0');

  // One choice for both stations: switched on from the stock station, seen in the lab station.
  await p.goto(B + '/store/settings#stock'); await p.waitForSelector('[data-testid="stock-options"]', { timeout: 20000 });
  await sw('تحذير عند إضافة نتيجة لمادة غير متوفرة').click();
  ok(await settled(async () => (await kv(p, 'station.stockOptions.v1'))?.warnOut === true), 'warning switched on in «المخزن والمشتريات»');
  await p.goto(B + '/station/settings#stock'); await p.waitForSelector('[data-testid="stock-options"]', { timeout: 20000 }); await p.waitForTimeout(300);
  ok(await sw('تحذير عند إضافة نتيجة لمادة غير متوفرة').getAttribute('aria-checked') === 'true', 'and shown on in the lab station\'s settings');
  await sw('السماح بالرصيد السالب').click();
  ok(await settled(async () => (await kv(p, 'station.stockOptions.v1'))?.allowNegative === true), 'negative stock switched on from the lab station');

  await hbVisit('مريض المخزن 2');
  ok((await p.locator('[data-testid="stock-out"]').innerText()).includes('كاشف الهيموغلوبين'), 'entry: «غير متوفر في المخزن» under the test');
  await p.locator('[data-result-idx="0"]').fill('12'); await p.keyboard.press('Control+s');
  ok(await settled(async () => (await p.locator('.station-toast', { hasText: 'تنبيه المخزن' }).count()) === 1), 'saving warns which materials were not in stock');
  ok(await settled(async () => ((await kv(p, 'station.stock.v1'))[0].qty) === -1), 'the count goes below zero (-1)');
  ok(((await kv(p, 'station.visits.v1')) || []).some((v) => v.patient.name === 'مريض المخزن 2'), 'the result is still saved');
  await p.goto(B + '/store/inventory'); await p.waitForSelector('[data-testid="stock-qty"]', { timeout: 20000 });
  const q = await p.locator('[data-testid="stock-qty"]').first().innerText();
  ok(q.includes('-1') && q.includes('بالسالب'), `the stock room shows the negative count (${q.replace(/\s+/g, ' ')})`);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
