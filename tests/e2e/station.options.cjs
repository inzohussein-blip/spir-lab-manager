const { B, OWNER, ok, launch, tmp, pdfPages, done, kv, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  // Settings save at once; wait until the saved copy has the change before opening another page.
  const settled = async (pred) => { for (let i = 0; i < 50; i++) { if (pred((await ls('station.settings.v1')) || {})) return true; await p.waitForTimeout(100); } return false; };
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140))); p.on('dialog', d => d.accept());
  const ls = (k) => kv(p, k);
  await p.goto(B + '/station'); await resetLocal(p, { 'local.activation.v1': 'legacy' }); await p.reload(); await p.waitForTimeout(1200);
  // defaults: all off
  ok(await p.locator('select[aria-label="وحدة العمر"]').count() === 0, 'default: no age-unit selector');
  await p.goto(B + '/station/visits'); await p.waitForTimeout(500);
  ok(await p.locator('th:has-text("التسليم")').count() === 0, 'default: no delivery column');
  await p.goto(B + '/station/tests'); await p.waitForTimeout(500);
  await p.fill('input[aria-label="بحث في الفحوصات"]', 'الإدرار');
  await p.locator('tbody tr', { hasText: 'فحص الإدرار العام' }).locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  ok(await p.locator('text=قيم أخرى تُعتبر طبيعية').count() === 0, 'default: no extra-normals editor');
  await p.locator('button[aria-label="إغلاق"]').click();
  // switch on from the settings page
  // two in «شاشة الإدخال», the third found with the settings search (it lives under «الاستمارات»)
  await p.goto(B + '/station/settings#entry'); await p.waitForTimeout(600);
  for (const l of ['وحدة العمر (سنة / شهر / يوم)', 'حالة تسليم النتائج']) await p.locator(`label:has(span:text-is("${l}"))`).locator('button[role=switch]').click();
  ok((await p.locator('[data-testid="badge-entry"]').innerText()).includes('مفعّل'), 'section badge counts what is on');
  await p.fill('input[aria-label="بحث في الإعدادات"]', 'قيم طبيعية إضافية');
  ok(await p.locator('[data-sec="forms"]:not([data-miss])').count() === 1 && await p.locator('[data-sec="device"][data-miss]').count() === 1, 'search shows only the section that has it');
  await p.locator('label:has(span:text-is("قيم طبيعية إضافية"))').locator('button[role=switch]').click();
  await settled((st) => st.formExtraNormals === true);
  const st = await ls('station.settings.v1');
  ok(st.ageUnit === true && st.deliveryStatus === true && st.formExtraNormals === true, 'three switches turn on from settings');
  // extra normals: bacteria "Few" counts as normal
  await p.goto(B + '/station/tests'); await p.waitForTimeout(500);
  await p.fill('input[aria-label="بحث في الفحوصات"]', 'الإدرار');
  await p.locator('tbody tr', { hasText: 'فحص الإدرار العام' }).locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
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
  const card = p.locator('div.group.rounded-xl', { hasText: 'فحص الإدرار العام' });
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
  // the lab's own colours on the printed report (Settings → «التقرير المطبوع: الألوان والجدول»)
  const color = (sel) => p.locator(sel).first().evaluate((e) => getComputedStyle(e).color);
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  const before = await color('#report-sheet h2');
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(600);
  const colors = p.locator('[data-testid="report-colors"]');
  ok(await colors.locator('button[aria-pressed="true"]').getAttribute('aria-label') === 'بنفسجي وذهبي (الأصلي)', 'colours: the original purple + gold by default');
  await colors.locator('button[aria-label="أزرق طبي"]').click(); await settled((st) => st.reportTable?.primary === '#1e4f91');
  const rt = (await ls('station.settings.v1')).reportTable;
  ok(rt.primary === '#1e4f91' && rt.accent === '#4fa3d9', 'a ready palette is saved');
  const blue = await color('[data-testid="settings-preview"] #report-sheet h2');
  ok(blue !== before, `preview shows the new colour (${blue})`);
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  ok(await color('#report-sheet h2') === blue && await color('#report-sheet .form-title') === blue, 'report letterhead and form title in the lab\'s colour');
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(600);
  await colors.locator('input[aria-label="اللون الرئيسي"]').fill('#f0e68c'); await p.waitForTimeout(300);
  ok((await ls('station.settings.v1')).reportTable.primary === '#f0e68c' && await colors.locator('button[aria-pressed="true"]').count() === 0, 'a custom colour is saved');
  ok(await p.locator('[data-testid="color-warning"]').count() === 1, 'a too-light main colour is warned about');
  await p.locator('button:has-text("الوضع الافتراضي (الشكل الأصلي)")').click(); await p.waitForTimeout(300);
  ok((await ls('station.settings.v1')).reportTable.primary === '#5a2a82' && await p.locator('[data-testid="color-warning"]').count() === 0, '«الوضع الافتراضي» brings the original colours back');
  // extra report options (Settings → «خيارات إضافية للتقرير المطبوع»), all off by default
  const extras = p.locator('[data-testid="report-extras"]');
  const sw = (l) => extras.locator(`label:has(span:text-is("${l}"))`).locator('button[role=switch]');
  const EXTRAS = ['الطباعة على ورق المختبر المطبوع مسبقاً', 'مكان الشعار والعلامة المائية', 'خط التقرير'];
  ok((await Promise.all(EXTRAS.map((l) => sw(l).getAttribute('aria-checked')))).every((x) => x === 'false'), 'extra report options: all off by default');
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  const sheet = p.locator('#report-sheet');
  ok(await sheet.locator('[data-testid="report-head"][data-logo="start"]').count() === 1 && await sheet.locator('[data-testid="report-watermark"]').count() === 1 && await sheet.getAttribute('data-pre') === null, 'report as before: logo beside the name, watermark');
  // pre-printed paper
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(600);
  await sw(EXTRAS[0]).click();
  await extras.locator('input[aria-label="المساحة أعلى الصفحة"]').fill('50');
  await settled((st) => st.prePrinted === true && st.prePrintedTop === 50);
  const st2 = await ls('station.settings.v1');
  ok(st2.prePrinted === true && st2.prePrintedTop === 50, 'pre-printed paper: on, 50 mm at the top');
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  const padTop = await sheet.evaluate((e) => parseFloat(getComputedStyle(e).paddingTop));
  ok(await sheet.getAttribute('data-pre') === '1' && await sheet.locator('h2').count() === 0 && await sheet.locator('[data-testid="report-watermark"]').count() === 0
    && Math.abs(padTop - 50 * 96 / 25.4) < 2 && await sheet.locator('[data-testid="report-head-pre"]:has-text("التاريخ")').count() >= 1, `pre-printed: no letterhead or watermark, 50 mm left blank (${padTop.toFixed(0)}px), the date stays`);
  // logo placement and watermark
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(600);
  await sw(EXTRAS[0]).click(); await sw(EXTRAS[1]).click();
  await extras.locator('select[aria-label="مكان الشعار"]').selectOption('center');
  await extras.locator('select[aria-label="العلامة المائية"]').selectOption('off');
  await settled((st) => !st.prePrinted && st.reportHeadOn === true && st.reportHead?.logo === 'center' && st.reportHead?.watermark === false);
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  ok(await sheet.getAttribute('data-pre') === null && await sheet.locator('[data-testid="report-head"][data-logo="center"]').count() >= 1 && await sheet.locator('[data-testid="report-watermark"]').count() === 0, 'logo centred above the name, no watermark');
  // font
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(600);
  await sw(EXTRAS[2]).click();
  await extras.locator('button[aria-label="Amiri (أميري)"]').click(); await settled((st) => st.reportFontOn === true && st.reportFont === 'amiri');
  ok((await ls('station.settings.v1')).reportFont === 'amiri', 'font chosen');
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  const family = await sheet.evaluate((e) => getComputedStyle(e).fontFamily);
  const loaded = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Amiri"', 'مختبر'); });
  ok(family.includes('Amiri') && loaded, `report in the chosen font (${family.split(',')[0]}, loaded: ${loaded})`);
  // switched off: back to the original report
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(600);
  await sw(EXTRAS[1]).click(); await sw(EXTRAS[2]).click();
  ok(await settled((st) => !st.reportHeadOn && !st.reportFontOn), 'both options saved as off');
  await p.goto(B + '/station?edit=' + v.id); await p.waitForTimeout(800);
  ok(await sheet.locator('[data-testid="report-head"][data-logo="start"]').count() === 1 && await sheet.locator('[data-testid="report-watermark"]').count() === 1
    && !(await sheet.evaluate((e) => getComputedStyle(e).fontFamily)).includes('Amiri'), 'options off again: the report as before');
  // other stations: one layout; the procurement letterhead copied from the lab station, its logo printed
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGOI0mr6D8IMMAYARDgIFbiRq5wAAAAASUVORK5CYII=', 'base64');
  const labName = (await ls('station.settings.v1')).labName || 'مختبر التحليلات المرضية';
  await p.goto(B + '/store/settings'); await p.waitForSelector('[data-testid="letterhead-card"]', { timeout: 15000 });
  ok(await p.locator('[data-testid="settings-nav"] [data-section]').count() === 4, 'stock and purchases settings: four sections');
  await p.click('button:has-text("نسخ من محطة المختبر")');
  await p.setInputFiles('[data-testid="letterhead-card"] input[aria-label="ملف الشعار"]', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  let ps = {}; for (let i = 0; i < 50 && !String(ps.logo || '').startsWith('data:image/'); i++) { await p.waitForTimeout(100); ps = (await ls('purchasing.settings.v1')) || {}; }
  ok(ps.orgName === labName && String(ps.logo).startsWith('data:image/'), `procurement letterhead: copied from the lab station (${ps.orgName}), own logo`);
  await p.goto(B + '/store/report'); await p.waitForSelector('[data-testid="store-report-logo"]', { timeout: 15000 });
  ok((await p.locator('#report-sheet h2').innerText()).includes(labName) && ((await p.locator('[data-testid="store-report-logo"]').getAttribute('src')) || '').startsWith('data:image/'), 'procurement report: the name and logo');
  // staff: work rules in their own section, saved when leaving the field
  await p.goto(B + '/roster/settings#rules'); await p.waitForSelector('text=سماحية التأخير', { timeout: 15000 });
  await p.locator('label:has-text("سماحية التأخير") input').fill('12'); await p.keyboard.press('Tab');
  let rs = {}; for (let i = 0; i < 50 && rs.graceMin !== 12; i++) { await p.waitForTimeout(100); rs = (await ls('roster.settings.v1')) || {}; }
  ok(rs.graceMin === 12 && (await p.locator('[data-testid="settings-saved"]').getAttribute('class')).includes('opacity-100'), 'staff rules: saved on leaving the field, «حُفظ» shown');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
