// «ملء الصفحة»: its own section in the lab station's settings (under «التقرير المطبوع»), and the ways
// that section adds — all off at first, all working while «ملء الصفحة» is on.
const { B, ok, launch, done, kv, kvPut, resetLocal, pdfPages } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  const sw = (label) => p.locator(`label:has(span:text-is("${label}"))`).locator('button[role=switch]');
  const set = async (patch) => { await kvPut(p, 'station.settings.v1', { ...((await kv(p, 'station.settings.v1')) || {}), ...patch }); };
  const fillOf = async () => Number(await p.locator('#report-sheet').first().getAttribute('data-fill'));
  const TESTS = ['Hemoglobin', 'Urea', 'Creatinine', 'Uric', 'Cholesterol', 'Glucose'];
  /** A new visit with the first n tests and a result for each. */
  const visit = async (n, name = 'مريض الملء') => {
    await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
    await p.locator('label:has-text("الاسم الثلاثي") input').fill(name);
    for (const q of TESTS.slice(0, n)) { await p.fill('input[placeholder="ابحث عن فحص…"]', q); await p.waitForTimeout(120); await p.locator('div.grid button:has(span.flex-1)').first().click(); }
    await p.fill('input[placeholder="ابحث عن فحص…"]', '');
    const inputs = p.locator('input[data-result-idx]');
    for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill(String(11 + i));
    await p.waitForTimeout(600);
  };

  // ── The section, and everything off at first ──
  await p.goto(B + '/station'); await p.waitForTimeout(1200);
  await p.goto(B + '/station/settings#fill'); await p.waitForSelector('[data-testid="fill-more"]', { timeout: 20000 });
  const secs = await p.locator('[data-testid="settings-nav"] [data-section]').evaluateAll((xs) => xs.map((x) => x.dataset.section));
  ok(secs.indexOf('fill') === secs.indexOf('report') + 1, `«ملء الصفحة» is its own section, right under «التقرير المطبوع» (${secs.join(', ')})`);
  const LABELS = ['ملء ذكي بقياس المساحة', 'التكبير حسب حجم الورق', 'مربع ملاحظات في الفراغ', 'تكبير اسم المختبر ومعلومات المريض أيضاً', 'عرض البطاقة لفحص أو فحصين', 'النتيجة السابقة عند وجود مساحة', 'درجة التكبير'];
  ok((await Promise.all([sw('ملء الصفحة عند قلة الفحوصات'), ...LABELS.map(sw)].map((x) => x.getAttribute('aria-checked')))).every((v) => v === 'false'), 'fill page and its 7 ways: all off at first');
  await sw('ملء الصفحة عند قلة الفحوصات').click();
  await sw('ملء ذكي بقياس المساحة').click();
  ok(await settled(async () => { const s = await kv(p, 'station.settings.v1'); return s?.reportFill === true && s?.fillSmart === true; }), 'switched on from the section');

  // ── Smart fill: larger than the fixed steps, and six tests still on one page ──
  await visit(2);
  const smart2 = await fillOf();
  await set({ fillSmart: false }); await visit(2);
  const steps2 = await fillOf();
  ok(smart2 > steps2, `smart fill grows the table more than the fixed steps (${steps2} → ${smart2})`);
  await set({ fillSmart: true }); await visit(6);
  ok(await fillOf() > 1, `six tests: still larger (${await fillOf()})`);
  await p.emulateMedia({ media: 'print' });
  ok(pdfPages(await p.pdf({ preferCSSPageSize: true, printBackground: true })) === 1, 'and the printed report stays on one page');
  await p.emulateMedia({ media: 'screen' });

  // ── By paper size: more on A4, less on A5 (fixed steps) ──
  await set({ fillSmart: false, fillPaper: true }); await visit(2);
  const a4 = await fillOf();
  await p.click('button:text-is("A5")'); await p.waitForTimeout(300);
  const a5 = await fillOf();
  ok(a4 > steps2 && a5 < steps2, `by paper: A4 ${a4}, A5 ${a5} (without: ${steps2})`);
  await p.click('button:text-is("A4")');

  // ── Level: a cap on the growth ──
  await set({ fillPaper: false, fillLevel: 'light' }); await visit(2);
  ok(await fillOf() <= 1.2, `level «خفيف»: the text grows at most 1.2× (${await fillOf()})`);
  await set({ fillLevel: 'full', fillSmart: true }); await visit(2);
  ok(await fillOf() > smart2, `level «كامل» with smart fill: more than the default (${smart2} → ${await fillOf()})`);
  await set({ fillLevel: undefined, fillSmart: false });

  // ── Notes box and a larger letterhead ──
  await set({ fillNotes: true, fillHead: true }); await visit(2);
  ok(await p.locator('#report-sheet [data-testid="report-notes"]').count() === 1, 'a «ملاحظات» box in the space above the signature');
  const zoom = await p.locator('#report-sheet [data-testid="report-patient"]').evaluate((e) => Number(e.style.zoom || 1));
  ok(zoom > 1, `the patient's details larger too (zoom ${zoom})`);
  await set({ fillNotes: false, fillHead: false });

  // ── Card view: one or two tests ──
  await set({ fillCard: true }); await visit(1);
  ok(await p.locator('#report-sheet [data-testid="report-cards"] [data-card]').count() === 1 && await p.locator('#report-sheet table[data-font]').count() === 0, 'one test: a large card instead of the table');
  ok((await p.locator('#report-sheet [data-testid="report-cards"]').innerText()).includes('Reference Range'), 'with its reference range');
  await visit(3);
  ok(await p.locator('#report-sheet [data-testid="report-cards"]').count() === 0 && await p.locator('#report-sheet table[data-font]').count() === 1, 'three tests: the table as usual');
  await set({ fillCard: false });

  // ── The previous result when there is room ──
  const PREV = 'مريض سابق';
  await visit(1, PREV); await p.keyboard.press('Control+s');
  ok(await settled(async () => ((await kv(p, 'station.visits.v1')) || []).some((v) => v.patient.name === PREV)), 'a visit saved');
  const visits = (await kv(p, 'station.visits.v1')) || [];
  const v2 = visits.find((v) => v.patient.name === PREV);
  // The same patient's earlier visit, a day before, with Hb 9.5.
  await kvPut(p, 'station.visits.v1', [...visits, { ...v2, id: 'older-visit', accession: 'LAB-OLD-1', created_at: v2.created_at - 86400000, results: v2.results.map((r) => ({ ...r, value: '9.5' })) }]);
  const id2 = v2.id;
  await p.goto(B + `/station?edit=${id2}`); await p.waitForTimeout(1500);
  ok(!(await p.locator('#report-sheet').innerText()).includes('Previous'), 'previous result not printed while its option is off');
  await set({ fillPrev: true }); await p.goto(B + `/station?edit=${id2}`); await p.waitForTimeout(1500);
  const sheet = await p.locator('#report-sheet').innerText();
  ok(sheet.includes('Previous') && sheet.includes('9.5'), 'switched on: the previous result (9.5) printed beside the new one');

  // ── Off: none of it ──
  await set({ reportFill: false }); await p.goto(B + `/station?edit=${id2}`); await p.waitForTimeout(1500);
  ok(!(await p.locator('#report-sheet').innerText()).includes('Previous') && await p.locator('#report-sheet').getAttribute('data-fill') === null, '«ملء الصفحة» off: its ways do nothing');

  // ── A long report on several pages: each page has the header (letterhead, sample barcode, patient)
  // and, at its bottom, the signature, QR code and footer bar — kept clear of the paper's edge ──
  await set({ footer: 'سطر التذييل للتجربة', signatureOn: true });
  await p.goto(B + '/station'); await p.waitForSelector('label:has-text("الاسم الثلاثي") input', { timeout: 20000 });
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض طويل');
  for (let i = 0; i < 30; i++) await p.locator('div.grid button:has(span.flex-1)').nth(i).click();
  const ins = p.locator('input[data-result-idx]'); for (let i = 0; i < await ins.count(); i++) await ins.nth(i).fill(String(10 + i));
  await p.evaluate(() => { window.print = () => {}; }); await p.click('[data-testid="entry-print"]'); await p.waitForTimeout(1500);
  // Printed from a page scrolled down (the print button under the results): printed from the top.
  const scr = await p.evaluate(async () => {
    document.body.style.minHeight = '5000px'; window.scrollTo(0, 1500); const a = window.scrollY;
    window.dispatchEvent(new Event('beforeprint')); const b = window.scrollY;
    window.dispatchEvent(new Event('afterprint')); const c = window.scrollY; document.body.style.minHeight = '';
    return [a, b, c];
  });
  ok(scr[0] > 0 && scr[1] === 0 && scr[2] === scr[0], `a scrolled page prints from its top, then goes back (${scr.join(' → ')})`);
  const titles = await p.evaluate(() => { const t0 = document.title; window.dispatchEvent(new Event('beforeprint')); const t1 = document.title; window.dispatchEvent(new Event('afterprint')); return [t0, t1, document.title]; });
  ok(/LAB-.* — مريض طويل/.test(titles[1]) && titles[2] === titles[0], `while printing the title is the sample number and patient (${titles[1]}), then back`);
  for (const paper of ['A4', 'A5']) {
    await p.click(`button:text-is("${paper}")`); await p.waitForTimeout(500);
    await p.emulateMedia({ media: 'print' });
    const lay = await p.evaluate(() => {
      const sh = document.querySelector('#report-sheet');
      const head = sh.querySelector('table.report-frame > thead');
      const css = [...document.querySelectorAll('style')].map((x) => x.textContent).join(' ');
      return {
        headHas: !!head.querySelector('[data-testid="report-patient"]') && !!head.querySelector('.report-pbc') && !!head.querySelector('h2'),
        bottom: getComputedStyle(sh.querySelector('.report-bottom')).position,
        bottomHas: !!sh.querySelector('.report-bottom .report-sign') && !!sh.querySelector('.report-bottom .report-footer'),
        spacer: sh.querySelector('.report-spacer').getBoundingClientRect().height,
        head: head.getBoundingClientRect().height,
        margin: (css.match(/@page \{ size: A[45]; margin: ([^;]+);/) || [])[1],
        bottomGap: parseFloat(getComputedStyle(sh.querySelector('.report-bottom')).bottom),
        topGap: parseFloat(getComputedStyle(head.querySelector('td')).paddingTop),
      };
    });
    const quarter = (paper === 'A5' ? 194 : 275) * 96 / 25.4 / 4;
    ok(lay.headHas && lay.bottom === 'fixed' && lay.bottomHas, `${paper}: letterhead, sample barcode and patient repeat on each page; signature, QR and footer fixed at each page's bottom`);
    ok(lay.spacer > 40 && lay.spacer < quarter && lay.head < quarter, `${paper}: the space kept for them fits the browser's limit for repeating (${Math.round(lay.head)} / ${Math.round(lay.spacer)} px < ${Math.round(quarter)})`);
    ok(lay.margin === '0' && lay.bottomGap >= 9 * 96 / 25.4 - 1 && lay.topGap >= 7 * 96 / 25.4 - 1, `${paper}: no page margins (no room for the browser's date / link lines), the sheet's own margins keep the footer off the edge (top ${Math.round(lay.topGap)}px, bottom ${Math.round(lay.bottomGap)}px)`);
    ok(pdfPages(await p.pdf({ preferCSSPageSize: true, printBackground: true })) >= 2, `${paper}: 30 tests print on several pages`);
    await p.emulateMedia({ media: 'screen' });
  }
  await p.click('button:text-is("A4")');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
