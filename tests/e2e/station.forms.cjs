// Report forms (urine, stool, semen, culture): entry, saving, reopening and printing (A4 + A5, one page each).
const { B, ok, launch, pdfPages, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  // An existing install whose catalog predates the stool / semen / culture forms.
  await p.goto(B + '/station'); await resetLocal(p, { 'local.activation.v1': 'legacy' }); await p.reload(); await p.waitForTimeout(1500);
  await kvPut(p, 'station.tests.v1', (await kv(p, 'station.tests.v1')).filter((x) => !['GSE', 'SFA', 'CS'].includes(x.code)));
  await kvPut(p, 'station.addFormTests.v1', null);
  await p.reload(); await p.waitForTimeout(800);
  const codes = (await kv(p, 'station.tests.v1')).map((x) => x.code);
  ok(['GUE', 'GSE', 'SFA', 'CS'].every((c) => codes.includes(c)), 'form tests are added to an existing catalog once');

  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض الاستمارات');
  await p.locator('label:has-text("الجنس") select').selectOption('male');
  await p.locator('label:has-text("العمر") input').fill('35');
  const pick = async (q) => { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(100); await p.locator('div.grid button:has(span.flex-1)').first().click(); };
  for (const q of ['Hemoglobin', 'General Urine', 'General Stool', 'Seminal Fluid', 'Culture & Sensitivity']) await pick(q);
  await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  await p.locator('div.group', { hasText: 'الهيموغلوبين' }).locator('input[data-result-idx]').first().fill('14.2');
  const card = (name) => p.locator('div.group.rounded-xl', { hasText: name });
  const badge = (name) => card(name).locator('span[dir=ltr]').innerText();
  const dlg = p.locator('div[role=dialog]');
  const choose = async (label, option) => {
    await dlg.locator(`input[aria-label="${label}"]`).click();
    await dlg.locator(`li button:has-text("${option}")`).first().click();
  };

  await card('تحليل البول العام').locator('button:has-text("ملء الطبيعي")').click();
  await card('تحليل البول العام').locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  await choose('Color', 'Dark Yellow'); await choose('Bacteria', 'More than (++++)');
  await dlg.locator('button:has-text("تم")').click();
  ok(await badge('تحليل البول العام') === '21/21', 'urine: every field filled');
  await card('فحص الخروج').locator('button:has-text("ملء الطبيعي")').click();

  await card('السائل المنوي').locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  await choose('Volume', '2.5 ml'); await choose('Sperm Concentration', '40 millions/ml');
  await choose('Progressive Motile (Active)', '45%'); await choose('Non-Progressive Motile (Sluggish)', '15%');
  ok(await dlg.locator('input[aria-label="Total Motility (PR + NP)"]').inputValue() === '60%', 'semen: total motility calculated (45% + 15%)');
  ok(await dlg.locator('input[aria-label="Total Sperm Count"]').inputValue() === '100 millions/ejaculate', 'semen: total count calculated (40 × 2.5)');
  await dlg.locator('button:has-text("ملء القيم الطبيعية")').click();
  await dlg.locator('button:has-text("تم")').click();

  await card('الزرع والحساسية').locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  await choose('Specimen', 'Urine'); await choose('Culture', 'Significant bacterial growth'); await choose('Organism', 'Klebsiella spp.');
  for (const [ab, x] of [['Amikacin', 'H.S'], ['Meropenem', 'H.S'], ['Aztreonam', 'R'], ['Ceftriaxone', 'M.S'], ['Streptomycin', 'H.S']])
    await dlg.locator(`button[aria-label="${ab} ${x}"]`).click();
  await dlg.locator('button:has-text("تم")').click();
  ok(await badge('الزرع والحساسية') === '2/2', 'culture: specimen + organism filled');

  await p.click('button:has-text("حفظ")'); await p.waitForTimeout(500);
  const vid = (await kv(p, 'station.visits.v1'))[0].id;
  await p.goto(B + '/station?edit=' + vid); await p.waitForTimeout(1000);
  ok(await badge('تحليل البول العام') === '21/21' && await badge('الزرع والحساسية') === '2/2', 'forms kept after reopening the visit');

  const sheet = await p.locator('#report-sheet').innerText();
  ok(sheet.includes('Growth of Klebsiella spp.') && sheet.includes('Conclusion'), 'printed sheet: culture line and semen conclusion');
  await p.emulateMedia({ media: 'print' });
  ok(pdfPages(await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })) === 5, 'A4: results + 4 forms = 5 pages');
  await p.emulateMedia({ media: 'screen' });
  await p.getByRole('button', { name: 'A5', exact: true }).click();
  await p.emulateMedia({ media: 'print' });
  ok(pdfPages(await p.pdf({ format: 'A5', printBackground: true, preferCSSPageSize: true })) === 5, 'A5: every report still one page');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
