// Procurement amounts (Arabic digits), the stock room in procurement linked to the lab station, the urine
// cell scale, the print button under the results, the «تمييز» highlight, and the stations' PIN.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  // WhatsApp is opened in a new tab: answered here (no internet needed).
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'wa' }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };

  // ── The stock room lives in procurement; the old address leads there ──
  await p.goto(B + '/station/inventory'); await p.waitForURL('**/store/inventory', { timeout: 20000 });
  ok(true, 'old /station/inventory opens the stock room in procurement');
  await p.goto(B + '/store/items'); await p.waitForSelector('label:has-text("اسم الصنف") input', { timeout: 20000 });
  await p.fill('label:has-text("اسم الصنف") input', 'كاشف السكر');
  await p.locator('input[aria-label="الكمية"]').pressSequentially('٥');
  ok(await p.locator('input[aria-label="الكمية"]').inputValue() === '5', 'Arabic-keyboard digit typed as 5');
  await p.click('button:has-text("إضافة")');
  ok(await settled(async () => ((await kv(p, 'station.stock.v1')) || []).some((s) => s.name === 'كاشف السكر' && s.qty === 5)), 'stock item saved (shared key with the lab station)');
  ok(await p.locator('aside a[href="/store"]:has-text("المشتريات")').count() === 1 && await p.locator('aside a[href="/store/inventory"]:has-text("المخزن")').count() === 1
    && await p.locator('aside a[href="/store/items"]:has-text("الأصناف")').count() === 1, 'purchases, stock and items: each in the side menu');

  // ── A purchase: typed amounts and the stock link ──
  await p.goto(B + '/store'); await p.waitForSelector('input[placeholder="الصنف"]', { timeout: 20000 });
  await p.fill('label:has-text("أو اسم مورّد مباشر") input', 'مورّد المخزن');
  await p.fill('input[placeholder="الصنف"]', 'كاشف السكر');
  const qty = p.locator('input[aria-label="الكمية"]'); const price = p.locator('input[aria-label="سعر الوحدة"]');
  await qty.fill(''); await qty.pressSequentially('٣');
  await price.click(); await price.pressSequentially('٢٥٠٠٠'); await price.press('Tab');
  ok(await price.inputValue() === '25,000', `price typed in Arabic digits shows as 25,000 (got ${await price.inputValue()})`);
  ok((await p.locator('body').innerText()).includes('75,000'), 'line total 3 × 25,000 = 75,000');
  ok(await p.locator('span:has-text("مخزن")').count() >= 1, 'the line is marked as a stock item');
  await p.click('button:has-text("حفظ العملية")');
  ok(await settled(async () => ((await kv(p, 'station.stock.v1')) || []).find((s) => s.name === 'كاشف السكر')?.qty === 8), 'buying 3 adds them to the stock room (5 → 8)');
  const pur = ((await kv(p, 'purchasing.purchases.v1')) || [])[0];
  ok(pur && pur.total === 75000 && pur.items[0].unitPrice === 25000, 'purchase saved with 25000 per unit');
  await p.reload(); await p.waitForSelector('input[placeholder="الصنف"]');
  await p.locator('tbody tr', { hasText: 'مورّد المخزن' }).locator('button').last().click();
  ok(await settled(async () => ((await kv(p, 'station.stock.v1')) || []).find((s) => s.name === 'كاشف السكر')?.qty === 5), 'deleting the purchase takes its quantity back (8 → 5)');
  // A line not yet in the stock room becomes a new item there.
  await p.fill('input[placeholder="الصنف"]', 'قفازات جديدة');
  await qty.fill(''); await qty.pressSequentially('4');
  await price.click(); await price.pressSequentially('1000'); await price.press('Tab');
  ok(await p.locator('span:has-text("جديد")').count() >= 1, 'a new line is marked «جديد»');
  await p.click('button:has-text("حفظ العملية")');
  ok(await settled(async () => ((await kv(p, 'station.stock.v1')) || []).find((s) => s.name === 'قفازات جديدة')?.qty === 4), 'the new line is added to the stock room (4)');

  // ── Lab station: print button under the results + highlight ──
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض التمييز');
  await p.locator('label:has-text("رقم الهاتف") input').fill('07701234567');
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'Hemoglobin'); await p.waitForTimeout(150);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  await p.locator('input[data-result-idx]').first().fill('9.1');
  ok(await p.locator('[data-testid="entry-print"]').isVisible(), 'print button under the results');
  // «واتساب»: the report as a PDF (saved here, as this browser cannot share files) and WhatsApp
  // opened on the patient's number in the international form.
  const [dl, wa] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), ctx.waitForEvent('page', { timeout: 30000 }), p.click('[data-testid="entry-whatsapp"]')]);
  const pdf = require('node:fs').readFileSync(await dl.path());
  ok(pdf.slice(0, 5).toString() === '%PDF-' && /\/Count 1\b/.test(pdf.toString('latin1')) && pdf.length > 20000, `WhatsApp: the report as a one-page PDF (${pdf.length} bytes, ${dl.suggestedFilename()})`);
  await wa.waitForLoadState().catch(() => {});
  ok(wa.url().startsWith('https://wa.me/9647701234567'), `WhatsApp opened on the patient's number (${wa.url().slice(0, 40)})`);
  await wa.close();
  await p.locator('input[aria-label^="تمييز"]').first().check();
  ok(await p.locator('#report-sheet tr[data-hl="1"] mark').count() === 1, 'ticked result is highlighted on the report');
  await p.click('button[title="حفظ (Ctrl+S)"]');
  ok(await settled(async () => ((await kv(p, 'station.visits.v1')) || []).some((v) => v.results.some((r) => r.hl))), 'highlight saved with the visit');
  const vid = ((await kv(p, 'station.visits.v1')) || []).find((v) => v.patient.name === 'مريض التمييز').id;
  await p.goto(B + '/station/visits'); await p.waitForTimeout(1200);
  await p.locator('tbody tr', { hasText: 'مريض التمييز' }).locator('button:has-text("عرض/طباعة")').click(); await p.waitForTimeout(600);
  ok(await p.locator('#report-sheet tr[data-hl="1"]').count() === 1, 'reprint keeps the highlight');
  // From «سجل المراجعين»: a patient's visit opens straight away (not the list of visits).
  await p.goto(B + '/station/records'); await p.waitForTimeout(800);
  await p.locator('text=مريض التمييز').first().click(); await p.waitForTimeout(300);
  await p.locator('[data-testid="open-visit"]').first().click();
  await p.waitForSelector('[data-testid="visit-open"]', { timeout: 15000 });
  ok(p.url().includes('open=') && (await p.locator('#report-sheet').first().innerText()).includes('مريض التمييز'), 'records → the visit opens directly');
  await p.goto(B + `/station?edit=${vid}`); await p.waitForTimeout(1500);
  ok(await p.locator('input[aria-label^="تمييز"]').first().isChecked(), 'editing the visit shows the tick');

  await p.goto(B + '/station/settings#entry'); await p.waitForTimeout(1200);
  for (const l of ['زر طباعة تحت إدخال النتائج', 'مربع «تمييز» بجانب كل نتيجة']) await p.locator(`label:has(span:text-is("${l}"))`).locator('button[role=switch]').click();
  ok(await settled(async () => { const s = await kv(p, 'station.settings.v1'); return s && s.entryPrintButton === false && s.entryHighlight === false; }), 'both entry options switched off in settings');
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input');
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'Hemoglobin'); await p.waitForTimeout(150);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  ok(await p.locator('[data-testid="entry-print"]').count() === 0 && await p.locator('input[aria-label^="تمييز"]').count() === 0, 'hidden when switched off');

  // ── Few tests: «ملء الصفحة» makes the results table larger ──
  const font = async () => Number(await p.locator('#report-sheet table[data-font]').first().getAttribute('data-font'));
  const before = await font();
  await p.goto(B + '/station/settings#report'); await p.waitForTimeout(1200);
  await p.locator('label:has(span:text-is("ملء الصفحة عند قلة الفحوصات"))').locator('button[role=switch]').click();
  ok(await settled(async () => (await kv(p, 'station.settings.v1'))?.reportFill === true), 'fill-page option switched on');
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input');
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'Hemoglobin'); await p.waitForTimeout(150);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  const after = await font();
  ok(after > before * 1.3, `one test: larger results table (${before}px → ${after}px)`);

  // ── Urine: pus cells and red cells as a sign scale ──
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'General Urine'); await p.waitForTimeout(150);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  await p.locator('div.group.rounded-xl', { hasText: 'فحص الإدرار العام' }).locator('button:has-text("الاستمارة")').click(); await p.waitForTimeout(300);
  const dlg = p.locator('div[role=dialog]');
  await dlg.locator('input[aria-label="Pus Cells (WBCs)"]').click();
  const opts = await dlg.locator('li button').allInnerTexts();
  ok(['Nil', '+', '++', '+++', '++++', 'More than (++++)'].every((o) => opts.some((t) => t.split('\n')[0].trim() === o)) && !opts.some((t) => t.includes('0 - 1')),
    'pus cells offer Nil, +, ++, +++, ++++, More than (++++) instead of counts');
  await dlg.locator('li button:has-text("More than (++++)")').first().click();
  await dlg.locator('input[aria-label="Albumin (Protein)"]').click();
  const chem = (await dlg.locator('li button').allInnerTexts()).map((t) => t.split('\n')[0].trim());
  ok(!chem.includes('Trace') && chem[chem.length - 1] === 'More than (++++)' && chem.includes('++++'), `albumin: no Trace, ends with More than (++++) (${chem.join(', ')})`);
  await dlg.locator('li button').first().click();
  await dlg.locator('button:has-text("تم")').click();
  ok((await p.locator('body').innerText()).includes('فحص الإدرار العام (G.U.E)'), 'urine test named «فحص الإدرار العام (G.U.E)»');
  // An existing catalog with the old name is renamed once.
  const cat = await kv(p, 'station.tests.v1');
  await kvPut(p, 'station.tests.v1', cat.map((x) => (x.code === 'GUE' ? { ...x, name_ar: 'تحليل البول العام' } : x)));
  await kvPut(p, 'station.renameGue.v1', null);
  await p.goto(B + '/station/tests'); await p.waitForTimeout(1500);
  ok((await kv(p, 'station.tests.v1')).find((x) => x.code === 'GUE').name_ar === 'فحص الإدرار العام (G.U.E)', 'old name «تحليل البول العام» renamed on an existing device');

  // ── PIN: none at first; switched on in settings; asked in a new window ──
  const q0 = await ctx.newPage();
  await q0.goto(B + '/station/settings#look'); await q0.waitForTimeout(1200);
  ok(await q0.locator('[data-testid="pin-gate"]').count() === 0, 'no PIN at first');
  await q0.click('[data-testid="pin-card"] button:has-text("تفعيل رمز الدخول")');
  await q0.fill('input[aria-label="الرمز الجديد"]', '1234'); await q0.fill('input[aria-label="تأكيد الرمز"]', '1235');
  await q0.click('button:has-text("حفظ الرمز")');
  ok(await q0.locator('text=الرمزان غير متطابقين').isVisible(), 'mismatched confirmation refused');
  await q0.fill('input[aria-label="تأكيد الرمز"]', '1234'); await q0.click('button:has-text("حفظ الرمز")');
  ok(await q0.locator('[data-testid="pin-card"]:has-text("مفعّل")').isVisible() && await q0.locator('[data-testid="pin-gate"]').count() === 0, 'PIN on; the window that set it stays open');
  await q0.close();

  const q = await ctx.newPage(); q.on('dialog', (d) => d.accept()); q.on('pageerror', (e) => errs.push(`${q.url()} ${e.message.slice(0, 140)}`));
  await q.goto(B + '/station'); await q.waitForTimeout(1200);
  ok(await q.locator('[data-testid="pin-gate"]').isVisible(), 'a new window asks for the PIN');
  await q.fill('input[aria-label="رمز الدخول"]', '9999'); await q.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await q.locator('text=رمز غير صحيح').isVisible(), 'wrong PIN refused');
  await q.fill('input[aria-label="رمز الدخول"]', '١٢٣٤'); await q.click('[data-testid="pin-gate"] button:has-text("دخول")');
  ok(await q.locator('[data-testid="pin-gate"]').count() === 0, 'right PIN (typed in Arabic digits) opens the station');
  await q.goto(B + '/store'); await q.waitForTimeout(1000);
  ok(await q.locator('[data-testid="pin-gate"]').count() === 0, 'other stations keep their own setting (none here)');
  await q.goto(B + '/station/settings#look'); await q.waitForTimeout(1000);
  await q.click('[data-testid="pin-card"] button:has-text("قفل الآن")');
  ok(await q.locator('[data-testid="pin-gate"]').isVisible(), '«قفل الآن» locks at once');
  await q.fill('input[aria-label="رمز الدخول"]', '1234'); await q.click('[data-testid="pin-gate"] button:has-text("دخول")');
  await q.click('[data-testid="pin-card"] button:has-text("إيقاف الرمز")');
  const q2 = await ctx.newPage(); await q2.goto(B + '/station'); await q2.waitForTimeout(1200);
  ok(await q2.locator('[data-testid="pin-gate"]').count() === 0, 'PIN switched off: no prompt');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
