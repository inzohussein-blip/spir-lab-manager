// Lab requests: the sample barcode can be hidden from the report, «تمييز» inside the urine / stool /
// semen / culture forms, «المخزن والمشتريات» as the station's name, the stock room's out-of-stock
// warning and negative stock (one choice, set from either station), the regrouped settings, and the
// stock station's «الأصناف» (the lab's tests and their materials) and automatic / manual deduction.
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
  ok((await p.locator('aside').innerText()).includes('المخزن والمشتريات') && (await p.locator('h1').first().innerText()).includes('المشتريات'), 'the station carries the new name');

  // ── Welcome page: appearance, about SPIR, privacy and disclaimer (at the bottom) ──
  await p.goto(B + '/welcome'); await p.waitForSelector('[data-testid="welcome-footer"]', { timeout: 20000 });
  await p.locator('[data-testid="site-theme"] button:has-text("غامق")').click();
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark' && localStorage.getItem('lab-theme') === 'dark'), 'welcome: dark mode chosen and applied');
  await p.reload(); await p.waitForSelector('[data-testid="site-theme"]', { timeout: 20000 });
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark') && await p.locator('[data-testid="site-theme"] button[aria-checked="true"]').innerText() === 'غامق', 'and kept after reload');
  await p.locator('[data-testid="site-theme"] button:has-text("فاتح")').click();
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme') === null && localStorage.getItem('lab-theme') === 'light'), 'light mode');
  await p.locator('[data-testid="site-theme"] button:has-text("تلقائي")').click();
  ok((await p.locator('[data-testid="about-spir"]').innerText()).includes('شركة برمجة'), 'about SPIR: a software company');
  await p.locator('[data-testid="disclaimer"] summary').click();
  ok((await p.locator('[data-testid="disclaimer"]').innerText()).includes('نحن لا نتحمل أي مسؤولية'), 'disclaimer: «نحن لا نتحمل أي مسؤولية»');
  await p.locator('[data-testid="privacy"] summary').click();
  ok((await p.locator('[data-testid="privacy"]').innerText()).includes('على جهاز المختبر'), 'privacy policy shown');

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

  // ── «الأصناف»: the lab's tests (from «إدارة الفحوصات») with their materials, then tubes ──
  await p.goto(B + '/store/items'); await p.waitForSelector('[data-testid="items-list"]', { timeout: 20000 });
  await p.click('button[role=tab]:has-text("التحاليل وموادها")'); await p.waitForSelector('[data-testid="items-tests"] tr[data-test]', { timeout: 20000 });
  const catalog = await kv(p, 'station.tests.v1');
  ok(await p.locator('[data-testid="items-tests"] tr[data-test]').count() === catalog.length, `every supported test is listed as an item (${catalog.length})`);
  ok((await p.locator('tr[data-test="HB"] [data-testid="test-materials"]').innerText()).includes('كاشف الهيموغلوبين'), 'a test shows its material');
  await p.locator('tr[data-test="UREA"] [data-testid="add-material"]').click();
  const urea = catalog.find((t) => t.code === 'UREA');
  const MAT = `كاشف ${urea.name_ar}`;
  ok(await settled(async () => ((await kv(p, 'station.stock.v1')) || []).some((x) => x.name === MAT && x.testIds?.includes(urea.id) && x.qty === 0)), 'one click: the test\'s material in the stock room (0, linked)');
  ok((await p.locator('tr[data-test="UREA"] [data-testid="test-materials"]').innerText()).includes(MAT), 'and shown beside the test');
  await p.click('button[role=tab]:has-text("الأصناف والكتات")'); await p.locator('[data-testid="stock-presets"]').click();
  ok(await settled(async () => (await p.locator('[data-section="supplies"] tbody tr', { hasText: 'أنبوب' }).count()) >= 2), 'tubes, syringe and containers listed under «المستلزمات»');
  ok(await p.locator(`[data-section="reagents"] tr[data-item="${MAT}"]`).count() === 1, 'the test\'s material under «الكواشف»');
  await p.click('[data-testid="supply-new"]');
  await p.fill('[data-testid="item-form"] label:has-text("اسم الصنف") input', 'شريط لاصق');
  ok(await p.locator('[data-testid="item-form"] button[aria-pressed="true"]:has-text("مستلزم")').count() === 1, '«مستلزم جديد» opens as a supply');
  await p.click('[data-testid="item-form"] button[type=submit]');
  ok(await settled(async () => ((await kv(p, 'station.stock.v1')) || []).some((x) => x.name === 'شريط لاصق' && x.byHand)), 'a supply saved (issued by hand)');

  // ── «المخزن»: add and issue by hand ──
  const ureaQty = async () => ((await kv(p, 'station.stock.v1')) || []).find((x) => x.name === MAT)?.qty;
  await p.goto(B + '/store/inventory'); await p.waitForSelector(`li[data-stock="${MAT}"]`, { timeout: 20000 });
  ok(((await kv(p, 'station.stockOptions.v1'))?.mode ?? 'auto') === 'auto', 'stock room: deduction is automatic by default');
  await p.click(`button[aria-label="إضافة إلى ${MAT}"]`);
  const md = p.locator('[data-testid="move-dialog"]');
  await md.locator('input[aria-label="كمية الحركة"]').fill('6');
  ok((await md.innerText()).includes('6'), 'the dialog shows the count after the move');
  await md.locator('button:has-text("حفظ الإضافة")').click();
  ok(await settled(async () => (await ureaQty()) === 6) && await md.count() === 0, 'added by hand (0 → 6), the dialog closes');
  await p.click(`button[aria-label="صرف من ${MAT}"]`); await md.locator('input[aria-label="كمية الحركة"]').press('Enter');
  ok(await settled(async () => (await ureaQty()) === 5), 'issued by hand: 1 by default, Enter saves (6 → 5)');
  await p.click('button[role=tab]:has-text("نفد أو ناقص")');
  ok(await p.locator(`li[data-stock="${MAT}"]`).count() === 0 && await p.locator('li[data-stock]').count() >= 1, 'the «نفد أو ناقص» filter shows only what ran low');

  // ── Results ↔ stock: automatic ──
  const ureaVisit = async (name) => {
    await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(name);
    await p.fill('input[placeholder="ابحث عن فحص…"]', 'اليوريا'); await p.waitForTimeout(150);
    await p.locator('div.grid button:has(span.flex-1)', { hasText: 'اليوريا' }).first().click();
    await p.fill('input[placeholder="ابحث عن فحص…"]', '');
    await p.locator('[data-result-idx="0"]').fill('30'); await p.keyboard.press('Control+s'); await p.waitForTimeout(700);
  };
  await ureaVisit('مريض اليوريا 1');
  ok(await settled(async () => (await ureaQty()) === 4), 'automatic: saving the result takes the material (5 → 4)');
  await p.locator('[data-result-idx="0"]').fill('31'); await p.keyboard.press('Control+s'); await p.waitForTimeout(700);
  ok((await ureaQty()) === 4, 'saving the same visit again takes nothing more');

  // ── Results ↔ stock: manual (set in the stock station's settings) ──
  await p.goto(B + '/store/settings#stock'); await p.waitForSelector('[data-testid="stock-mode"]', { timeout: 20000 });
  await p.click('button[aria-label="الحسم يدوي"]');
  ok(await settled(async () => (await kv(p, 'station.stockOptions.v1'))?.mode === 'manual'), 'manual deduction chosen in «المخزن والمشتريات ← الإعدادات»');
  await ureaVisit('مريض اليوريا 2');
  ok((await ureaQty()) === 4, 'manual: saving the result leaves the stock as it is');
  await ureaVisit('مريض اليوريا 3');
  await p.goto(B + '/store/inventory'); await p.waitForSelector('[data-testid="stock-pending"] li', { timeout: 20000 });
  ok(await p.locator('[data-testid="stock-pending"] li').count() === 2 && (await p.locator('[data-testid="stock-pending-count"]').innerText()).trim() === '2', 'both results wait in «نتائج بانتظار الصرف» (and on the menu)');
  ok((await p.locator('li[data-pending="مريض اليوريا 2"]').innerText()).includes(MAT), 'with the material they use');
  await p.click('button[aria-label="صرف مريض اليوريا 2"]');
  ok(await settled(async () => (await ureaQty()) === 3), 'issued by the examiner (4 → 3)');
  await p.click('button[aria-label="تجاهل مريض اليوريا 3"]');
  ok(await settled(async () => (await p.locator('[data-testid="stock-pending"] li').count()) === 0) && (await ureaQty()) === 3, 'skipped without taking stock; nothing waits');
  // The same choice shows in the lab station's settings.
  await p.goto(B + '/station/settings#stock'); await p.waitForSelector('[data-sec="stock"] [data-testid="stock-mode"]', { timeout: 20000 });
  ok(await p.locator('[data-sec="stock"] button[aria-label="الحسم يدوي"]').getAttribute('aria-pressed') === 'true', 'the lab station\'s settings show the same choice (manual)');

  // «صرف المواد» on the lab station's entry screen.
  await ureaVisit('مريض اليوريا 5');
  const issueBtn = p.locator('[data-testid="entry-issue"]');
  const issueText = (await issueBtn.innerText().catch(() => '')).trim();
  ok(/\(\d+\)/.test(issueText) && ((await issueBtn.getAttribute('title')) || '').includes(MAT), `entry screen: «صرف المواد من المخزن» after saving, with the test's material and tube (${issueText})`);
  await issueBtn.click();
  ok(await settled(async () => (await ureaQty()) === 2), 'issued from the entry screen (3 → 2)');
  ok(await p.locator('[data-testid="entry-issued"]').isVisible(), 'the visit shows its materials were issued');
  await p.locator('[data-result-idx="0"]').fill('33'); await p.keyboard.press('Control+s'); await p.waitForTimeout(700);
  ok((await ureaQty()) === 2 && await p.locator('[data-testid="entry-issue"]').count() === 0, 'saving it again takes nothing more');

  // Quality control runs wait too.
  await p.goto(B + '/qc/analytes'); await p.waitForTimeout(1200);
  const mat = ((await kv(p, 'station.stock.v1')) || []).find((x) => x.name === MAT);
  await kvPut(p, 'qc.analytes.v1', (await kv(p, 'qc.analytes.v1')).map((a, i) => (i === 0 ? { ...a, stockId: mat.id } : a)));
  await p.goto(B + '/qc/entry'); await p.waitForSelector('input[placeholder="القيمة"]', { timeout: 20000 });
  const qv = p.locator('input[placeholder="القيمة"]').first(); await qv.fill('95'); await qv.press('Tab'); await p.waitForTimeout(800);
  ok((await ureaQty()) === 2, 'manual: a control run leaves the stock as it is');
  await p.goto(B + '/store/inventory'); await p.waitForSelector('[data-testid="stock-pending-qc"] li', { timeout: 20000 });
  ok(await p.locator('[data-testid="stock-pending-qc"] li').count() === 1 && (await p.locator('[data-testid="stock-pending-count"]').innerText()).trim() === '1', 'the control run waits in «بانتظار الصرف»');
  await p.locator('[data-testid="stock-pending-qc"] button:has-text("صرف")').first().click();
  ok(await settled(async () => (await ureaQty()) === 1) && await p.locator('[data-testid="stock-pending-qc"]').count() === 0, 'issued: one unit of the control material (2 → 1)');

  await p.goto(B + '/store/settings#stock'); await p.waitForSelector('[data-testid="stock-mode"]', { timeout: 20000 });
  await p.click('button[aria-label="الحسم تلقائي"]');
  ok(await settled(async () => (await kv(p, 'station.stockOptions.v1'))?.mode === 'auto'), 'automatic deduction chosen again');
  await ureaVisit('مريض اليوريا 4');
  ok(await settled(async () => (await ureaQty()) === 0), 'back to automatic (1 → 0)');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
