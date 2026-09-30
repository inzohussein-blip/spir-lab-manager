// «الدليل»: the training station's guide from scratch — first in the sidebar, browsed by chapter,
// searched, filled from the station's own tools, tubes and tests, and printed as a book or one chapter.
const { B, ok, launch, done, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  await p.goto(B + '/training'); await p.waitForTimeout(1500);

  const first = await p.locator('aside nav a').first();
  ok((await first.getAttribute('href')) === '/training/guide' && (await first.innerText()).includes('الدليل'), '«الدليل» is the first item in the sidebar');
  ok(await p.locator('aside nav a:has-text("طباعة البروسيجرات")').count() === 1, 'the SOP book is «طباعة البروسيجرات»');
  await first.click(); await p.waitForSelector('[data-testid="guide-toc"]', { timeout: 20000 });

  const chapters = await p.locator('main .no-print section[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')));
  ok(chapters.length === 13 && chapters[0] === 'intro' && chapters.indexOf('devices') < chapters.indexOf('tubes') && chapters.indexOf('separation') < chapters.indexOf('reading'),
    `the chapters in order: basics, devices, tubes, collection, separation … reading (${chapters.join(', ')})`);
  ok(await p.locator('[data-testid="guide-toc"] a').count() === 13, 'the contents list every chapter');
  const text = await p.locator('main .no-print').innerText();
  ok(['جهاز الطرد المركزي', 'ترتيب السحب', 'المصل والبلازما', 'قواعد وستغارد', 'أنماط التشخيص الشائعة', 'القيم الحرجة'].every((s) => text.includes(s)), 'explained from scratch: centrifuge, order of draw, serum/plasma, Westgard, diagnosis, critical values');

  // Filled from the station's own data.
  const tools = await p.locator('main .no-print [data-testid="guide-auto-tools"]').innerText();
  ok(tools.includes('الأجهزة') && tools.includes('الكواشف'), 'the lab\'s tools grouped by kind');
  ok(await p.locator('main .no-print [data-testid="guide-auto-tubes"] tbody tr').count() >= 5, 'the lab\'s tubes');
  const cats = await p.locator('main .no-print [data-testid="guide-auto-categories"]').innerText();
  ok(cats.includes('فحوصات TORCH') && cats.includes('الغدة الدرقية'), 'each category with why it matters and its tests');
  ok(await p.locator('main .no-print [data-testid="guide-auto-index"] tbody tr').count() === 93, 'the index lists all 93 tests');
  await p.click('main .no-print [data-testid="guide-auto-index"] a:has-text("TSH")');
  await p.waitForURL(/\/training\/test\/x-tsh/, { timeout: 10000 });
  ok(true, 'a test in the index opens its page');
  await p.goBack(); await p.waitForSelector('[data-testid="guide-toc"]', { timeout: 20000 });

  // Contents jump to a chapter.
  await p.click('[data-testid="guide-toc"] a[href="#ch-reading"]'); await p.waitForTimeout(600);
  const top = await p.locator('#ch-reading').evaluate((e) => e.getBoundingClientRect().top);
  ok(top >= 0 && top < 120, `the contents jump to «قراءة النتيجة» (top ${Math.round(top)})`);

  // Search.
  await p.fill('[data-testid="guide-search"]', 'وستغارد'); await p.waitForTimeout(300);
  const found = await p.locator('main .no-print section[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')));
  ok(found.length === 1 && found[0] === 'qc', `search shows the chapter that has it (${found.join(', ')})`);
  await p.fill('[data-testid="guide-search"]', 'كلمة غير موجودة إطلاقاً'); await p.waitForTimeout(300);
  ok((await p.locator('main').innerText()).includes('لا توجد نتائج'), 'and says when nothing matches');
  await p.fill('[data-testid="guide-search"]', '');

  // Print: the whole book, then one chapter.
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  await p.evaluate(() => window.scrollTo(0, 3000));
  await p.click('[data-testid="guide-print"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__printed) === 1, 'the print button prints');
  await p.emulateMedia({ media: 'print' });
  const doc = p.locator('[data-testid="guide-doc"]');
  ok(await doc.isVisible() && (await doc.locator('section[data-chapter]').count()) === 13, 'printed: all chapters');
  const book = await doc.innerText();
  ok(book.includes('Laboratory Training Guide') && book.includes('المحتويات'), 'with a cover and contents');
  const pdf = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pages >= 20, `the book is many pages (${pages})`);
  require('fs').writeFileSync(process.env.GUIDE_PDF || '/dev/null', pdf);
  await p.emulateMedia({ media: 'screen' });
  await p.selectOption('[data-testid="guide-print-what"]', 'tubes');
  await p.emulateMedia({ media: 'print' });
  const one = await doc.locator('section[data-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter')));
  ok(one.length === 1 && one[0] === 'tubes' && !(await doc.innerText()).includes('المحتويات'), 'one chapter prints alone');
  const pdf1 = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages1 = (pdf1.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pages1 >= 1 && pages1 <= 3, `one chapter is a few pages (${pages1})`);
  await p.emulateMedia({ media: 'screen' });

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
