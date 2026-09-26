const { B, OWNER, ok, launch, tmp, pdfPages, done } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140))); p.on('dialog', d => d.accept());
  const ls = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
  await p.goto(B + '/station'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('local.activation.v1', 'legacy'); }); await p.reload(); await p.waitForTimeout(1200);
  // defaults: all off
  ok(await p.locator('select[aria-label="وحدة العمر"]').count() === 0, 'default: no age-unit selector');
  await p.goto(B + '/station/visits'); await p.waitForTimeout(500);
  ok(await p.locator('th:has-text("التسليم")').count() === 0, 'default: no delivery column');
  await p.goto(B + '/station/tests'); await p.waitForTimeout(500);
  await p.fill('input[aria-label="بحث في الفحوصات"]', 'البول');
  await p.locator('tbody tr', { hasText: 'تحليل البول العام' }).locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  ok(await p.locator('text=قيم أخرى تُعتبر طبيعية').count() === 0, 'default: no extra-normals editor');
  await p.locator('button[aria-label="إغلاق"]').click();
  // switch on from the settings page
  await p.goto(B + '/station/settings'); await p.waitForTimeout(600);
  for (const l of ['وحدة العمر (سنة / شهر / يوم)', 'حالة تسليم النتائج', 'قيم طبيعية إضافية في محرر الاستمارات']) await p.locator(`label:has(span:text-is("${l}"))`).locator('button[role=switch]').click();
  const st = await ls('station.settings.v1');
  ok(st.ageUnit === true && st.deliveryStatus === true && st.formExtraNormals === true, 'three switches turn on from settings');
  // extra normals: bacteria "Few" counts as normal
  await p.goto(B + '/station/tests'); await p.waitForTimeout(500);
  await p.fill('input[aria-label="بحث في الفحوصات"]', 'البول');
  await p.locator('tbody tr', { hasText: 'تحليل البول العام' }).locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  const dlg = p.locator('div[role=dialog]');
  const bac = dlg.locator('div.p-3', { has: p.locator('input[aria-label="اسم الحقل"][value="Bacteria"]') });
  await bac.locator('summary:has-text("قيم أخرى")').click();
  await bac.locator('button[aria-pressed]:text-is("Few")').click();
  const col = dlg.locator('div.p-3', { has: p.locator('input[aria-label="اسم الحقل"][value="Color"]') });
  await col.locator('summary:has-text("قيم أخرى")').click();
  await col.locator('label:has-text("حقل وصفي") input').check();
  await p.screenshot({ path: tmp('feat-editor.png') });
  await dlg.locator('button:has-text("حفظ")').click(); await p.waitForTimeout(300);
  const g = (await ls('station.formTemplates.v1')).GUE.sections;
  const f = (k) => g.flatMap(s => s.rows).find(r => r.label === k);
  ok(f('Bacteria').ok?.includes('Few') && f('Color').noFlag === true, 'extra normal + descriptive saved on the fields');
  // entry: age unit + GUE
  await p.goto(B + '/station'); await p.waitForTimeout(800);
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('طفل التجربة');
  await p.fill('input[aria-label="العمر"]', '6'); await p.selectOption('select[aria-label="وحدة العمر"]', 'm');
  await p.fill('input[aria-label="العمر"]', ''); await p.fill('input[aria-label="العمر"]', '7');
  const pick = async (q) => { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(100); await p.locator('div.grid button:has(span.flex-1)').first().click(); };
  await pick('General Urine'); await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  const card = p.locator('div.group.rounded-xl', { hasText: 'تحليل البول العام' });
  await card.locator('button:has-text("ملء الطبيعي")').click();
  await card.locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  await dlg.locator('input[aria-label="Bacteria"]').fill('Few'); await p.keyboard.press('Escape');
  await dlg.locator('input[aria-label="Color"]').fill('Red / Bloody'); await p.keyboard.press('Escape');
  await dlg.locator('input[aria-label="Yeast Cells"]').fill('Few'); await p.keyboard.press('Escape');
  await dlg.locator('button:has-text("تم")').click();
  await p.keyboard.press('Control+s'); await p.waitForTimeout(400);
  const v = (await ls('station.visits.v1'))[0];
  ok(v.patient.age === '7 أشهر', `age saved with unit, unit kept after retyping ("${v.patient.age}")`);
  const weights = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll('#report-sheet table.form-table tr').forEach(tr => { const td = tr.querySelectorAll('td'); if (td.length === 3) out[td[0].textContent.trim()] = getComputedStyle(td[1]).fontWeight; });
    return out;
  });
  ok(weights['Bacteria'] === '400' && weights['Color'] === '400' && weights['Yeast Cells'] === '700', `bold: Bacteria Few normal (${weights['Bacteria']}), Color descriptive (${weights['Color']}), Yeast Few bold (${weights['Yeast Cells']})`);
  ok(await p.locator('#report-sheet:has-text("7 أشهر")').count() >= 1, 'printed age shows "7 أشهر"');
  // reopen edit: unit shows month
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  ok(await p.inputValue('select[aria-label="وحدة العمر"]') === 'm' && await p.inputValue('input[aria-label="العمر"]') === '7', 'edit reopens with 7 + شهر');
  // delivery
  await p.goto(B + '/station/visits'); await p.waitForTimeout(600);
  ok(await p.locator('button:has-text("لم تُسلَّم")').count() === 1, 'delivery column shows «لم تُسلَّم»');
  await p.locator('button:has-text("لم تُسلَّم")').click(); await p.waitForTimeout(200);
  ok(!!(await ls('station.visits.v1'))[0].delivered_at && await p.locator('button:has-text("سُلِّمت")').count() === 1, 'mark delivered saves the date');
  await p.selectOption('select[aria-label="حالة التسليم"]', 'pending');
  ok(await p.locator('text=لا نتائج مطابقة').count() === 1, 'filter «لم تُسلَّم» hides delivered visit');
  // edit + save keeps delivered
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  await p.locator('label:has-text("رقم الهاتف") input').fill('0780'); await p.keyboard.press('Control+s'); await p.waitForTimeout(400);
  ok(!!(await ls('station.visits.v1'))[0].delivered_at, 'editing the visit keeps its delivery mark');
  await p.goto(B + '/station/records'); await p.waitForTimeout(500); await p.locator('text=طفل التجربة').first().click(); await p.waitForTimeout(300);
  const info = await p.locator('div.text-xs.text-muted', { hasText: '7 أشهر' }).first().innerText().catch(() => '');
  ok(info.includes('7 أشهر') && !info.includes('سنة'), `records page age "${info.trim()}"`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
