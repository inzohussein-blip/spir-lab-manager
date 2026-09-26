const { B, OWNER, ok, launch, tmp, pdfPages, done } = require('./lib.cjs');
const fs = require('node:fs');
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  p.on('dialog', d => d.accept());
  const ls = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
  await p.goto(B + '/station'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('local.activation.v1', 'legacy'); }); await p.reload(); await p.waitForTimeout(1200);
  const tests = await ls('station.tests.v1');
  const hb = tests.find(t => /hemoglobin/i.test(t.name_en || '')), glu = tests.find(t => /glucose/i.test(t.name_en || ''));
  // stock linked to Hb
  await p.evaluate((id) => localStorage.setItem('station.stock.v1', JSON.stringify([{ id: 's1', name: 'Hb reagent', qty: 5, minQty: 1, linkedTestId: id }])), hb.id);
  await p.reload(); await p.waitForTimeout(800);
  const pick = async (q) => { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(100); await p.locator('div.grid button:has(span.flex-1)').first().click(); };
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض التدقيق');
  await p.locator('label:has-text("الجنس") select').selectOption('female');
  await p.locator('label:has-text("العمر") input').fill('30');
  await p.locator('label:has-text("رقم الهاتف") input').fill('07700000000');
  await pick(hb.name_en); await pick('General Urine'); await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  await p.locator('[data-result-idx="0"]').fill('9');
  const flag = await p.locator('div.group', { hasText: hb.name_ar }).locator('span.rounded-full.size-6').first().innerText().catch(() => '?');
  ok(flag === 'L', `Hb 9 (female) flagged L — got ${flag}`);
  await p.locator('div.group.rounded-xl', { hasText: 'تحليل البول العام' }).locator('button:has-text("ملء الطبيعي")').click();
  ok(await p.locator('text=غير محفوظ').count() > 0, 'unsaved badge shows before saving');
  await p.keyboard.press('Control+s'); await p.waitForTimeout(400);
  ok((await ls('station.visits.v1')).length === 1, 'Ctrl+S saved one visit');
  ok((await ls('station.stock.v1'))[0].qty === 4, 'stock deducted once on save (5→4)');
  ok(await p.locator('text=غير محفوظ').count() === 0, 'unsaved badge cleared after save');
  // print twice -> same accession, no extra deduction
  await p.evaluate(() => { window.print = () => {}; });
  await p.click('button:has-text("طباعة A4")'); await p.waitForTimeout(400);
  const acc1 = (await ls('station.visits.v1'))[0].accession;
  await p.click('button:has-text("طباعة A4")'); await p.waitForTimeout(400);
  const v = await ls('station.visits.v1');
  ok(v.length === 1 && v[0].accession === acc1 && /^LAB-\d{8}-001$/.test(acc1), `print twice keeps one visit + same sample no. (${acc1})`);
  ok((await ls('station.stock.v1'))[0].qty === 4, 'printing does not deduct stock again');
  // edit: add glucose
  await p.goto(B + '/station?edit=' + v[0].id); await p.waitForTimeout(900);
  ok(await p.locator('h1:has-text("تعديل زيارة")').count() === 1, 'edit mode opens');
  await pick(glu.name_en); await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  await p.locator('div.group', { hasText: glu.name_ar }).locator('input[data-result-idx]').first().fill('95');
  await p.keyboard.press('Control+s'); await p.waitForTimeout(400);
  const v2 = await ls('station.visits.v1');
  ok(v2.length === 1 && v2[0].results.length === 3 && v2[0].accession === acc1, 'edit updates same visit (3 results, same sample no.)');
  ok((await ls('station.stock.v1'))[0].qty === 4, 'edit does not re-deduct Hb stock');
  // second visit for same patient -> previous result
  await p.goto(B + '/station'); await p.waitForTimeout(800);
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض التد');
  await p.locator('button:has-text("مريض التدقيق")').first().click();
  ok(await p.locator('text=مراجع مسجّل').count() === 1, 'name suggestion links the registered patient');
  await pick(hb.name_en); await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  ok(await p.locator('text=السابق:').count() >= 1, 'previous Hb result shown for returning patient');
  await p.locator('div.group', { hasText: hb.name_ar }).locator('input[data-result-idx]').first().fill('11');
  const delta = await p.locator('span[dir=ltr]:has-text("▲")').first().innerText().catch(() => '');
  ok(delta.includes('+2'), `change vs previous shows +2 ▲ (${delta})`);
  // unsaved guard on new visit
  let asked = false; p.removeAllListeners('dialog'); p.on('dialog', d => { asked = true; d.dismiss(); });
  await p.click('button:has-text("زيارة جديدة")'); await p.waitForTimeout(200);
  ok(asked && await p.locator('label:has-text("الاسم الثلاثي") input').inputValue() !== '', 'new-visit asks before discarding unsaved data');
  p.removeAllListeners('dialog'); p.on('dialog', d => d.accept());
  await p.keyboard.press('Control+s'); await p.waitForTimeout(400);
  ok((await ls('station.patients.v1')).length === 1, 'returning patient not duplicated');
  // visits page
  await p.goto(B + '/station/visits'); await p.waitForTimeout(700);
  ok(await p.locator('tbody tr').count() === 2, 'visits page lists 2 visits');
  await p.locator('button:has-text("عرض/طباعة")').last().click(); await p.waitForTimeout(400);
  ok(await p.locator('#report-sheet').count() >= 1 && await p.locator('#report-sheet:has-text("GENERAL URINE")').count() >= 1, 'reprint shows results + urine form');
  const a5btn = await p.locator('button:text-is("A5")').count();
  ok(a5btn > 0, 'reprint offers A5 paper choice');
  // CSV
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("تصدير CSV")')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.includes('مريض التدقيق') && !csv.includes('__tpl__'), 'CSV exported, forms as readable text');
  // records
  await p.goto(B + '/station/records'); await p.waitForTimeout(600);
  await p.locator('text=مريض التدقيق').first().click(); await p.waitForTimeout(300);
  ok(await p.locator('text=سجل الزيارات والفحوصات (2)').count() === 1, 'patient history shows both visits');
  // custom form edit then backup round trip
  await p.evaluate(() => localStorage.setItem('station.formTemplates.v1', JSON.stringify({ CS: { title: 'MY CULTURE', specimens: [], colony: [], organisms: [], antibiotics: [{ group: 'x', items: ['Abc'] }] } })));
  await p.goto(B + '/station/settings'); await p.waitForTimeout(600);
  const [bk] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("تصدير نسخة احتياطية")')]);
  const backup = JSON.parse(fs.readFileSync(await bk.path(), 'utf8'));
  ok(backup.visits.length === 2 && backup.patients.length === 1 && backup.stock.length === 1, 'backup has visits, patients, stock');
  ok(!!backup.forms, 'backup includes edited report forms');
  // restore into a clean browser
  const ctx2 = await b.newContext(); const q = await ctx2.newPage(); q.on('dialog', d => d.accept());
  await q.goto(B + '/station/settings'); await q.evaluate(() => { localStorage.clear(); localStorage.setItem('local.activation.v1', 'legacy'); }); await q.reload(); await q.waitForTimeout(800);
  await q.setInputFiles('input[type=file][accept*="json"]', await bk.path()); await q.waitForTimeout(1500);
  const r = await q.evaluate(() => ({ v: JSON.parse(localStorage.getItem('station.visits.v1') || '[]').length, f: localStorage.getItem('station.formTemplates.v1') }));
  ok(r.v === 2, 'restore brings back visits');
  ok(!!r.f && r.f.includes('MY CULTURE'), 'restore brings back edited forms');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
