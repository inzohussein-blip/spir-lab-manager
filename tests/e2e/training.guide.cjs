// «الدليل»: the training station's guide from scratch — first in the sidebar, browsed by chapter,
// searched, filled from the station's own tools, tubes and tests, and printed as a book or one chapter.
const { B, ok, launch, done, resetLocal, kv, kvPut } = require('./lib.cjs');
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

  // ── The printed book carries the lab's logo, name and details ──
  await p.emulateMedia({ media: 'screen' });
  await kvPut(p, 'station.settings.v1', { ...((await kv(p, 'station.settings.v1')) || {}), labName: 'مختبر النور التخصصي', labSubtitle: 'للتحليلات المرضية', footer: 'بغداد — 07700000000' });
  await p.goto(B + '/training/settings#print'); await p.waitForSelector('[data-testid="training-copy-lab"]', { timeout: 20000 });
  await p.click('[data-testid="training-copy-lab"]');
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  ok(await settled(async () => ((await kv(p, 'training.settings.v1')) || {}).title === 'مختبر النور التخصصي'), '«نسخ من محطة المختبر»: the lab\'s name and details');
  ok(((await kv(p, 'training.settings.v1')) || {}).contact === 'بغداد — 07700000000', 'with its address and phone');
  await p.goto(B + '/training/guide'); await p.waitForSelector('[data-testid="guide-toc"]', { timeout: 20000 });
  ok((await p.locator('[data-testid="guide-disclaimer"]').innerText()).includes('قابل للتعديل'), 'the guide says it is an editable reference');
  await p.selectOption('[data-testid="guide-print-what"]', '');
  await p.emulateMedia({ media: 'print' });
  const cover = await p.locator('[data-testid="guide-cover-head"]').innerText();
  ok(cover.includes('مختبر النور التخصصي') && cover.includes('بغداد — 07700000000'), 'the cover: the lab\'s name, details and logo');
  ok(await p.locator('[data-testid="guide-cover-head"] img, [data-testid="guide-cover-head"] .skeleton').count() >= 1, 'with the logo');
  ok(await p.locator('[data-testid="guide-doc"] [data-testid="guide-page-head"]').count() === 14, 'the letterhead on the contents and on every chapter');
  await p.emulateMedia({ media: 'screen' });

  // ── Everything in the guide can be edited ──
  await p.click('[data-testid="guide-edit"]'); await p.waitForSelector('[data-testid="guide-edit-bar"]');
  const ch1 = p.locator('section[data-chapter="intro"]');
  await ch1.locator('input[aria-label="عنوان الفصل"]').fill('المختبر من الصفر — نسخة المختبر');
  const sec1 = ch1.locator('[data-testid="guide-section-edit"]').first();
  await sec1.locator('[data-testid="guide-add-block"] button:has-text("فقرة")').click();
  await sec1.locator('[data-testid="guide-block-edit"]').last().locator('textarea').fill('فقرة كتبها المختبر بنفسه.');
  await sec1.locator('[data-testid="guide-add-block"] button:has-text("جدول")').click();
  await sec1.locator('[data-testid="guide-block-edit"]').last().locator('textarea').fill('الجهاز | الموقع\nالطرد المركزي | غرفة 2');
  await ch1.locator('[data-testid="guide-add-section"]').click();
  await ch1.locator('[data-testid="guide-section-edit"]').last().locator('input[aria-label="عنوان القسم"]').fill('قسم أضافه المختبر');
  await p.click('[data-testid="guide-add-chapter"]');
  const last = p.locator('section[data-editing]').last();
  await last.locator('input[aria-label="عنوان الفصل"]').fill('فصل خاص بمختبرنا');
  const why = p.locator('[data-testid="guide-why"] textarea').first();
  await why.fill('وصف الأهمية بصياغة المختبر.');
  ok(await settled(async () => (await p.locator('[data-testid="guide-saved"]').innerText()).includes('حُفظ')), 'saved by itself');
  await p.click('[data-testid="guide-edit"]');
  await p.reload(); await p.waitForSelector('[data-testid="guide-toc"]', { timeout: 20000 });
  const view = await p.locator('main .no-print').innerText();
  ok(view.includes('المختبر من الصفر — نسخة المختبر') && view.includes('فقرة كتبها المختبر بنفسه.') && view.includes('غرفة 2') && view.includes('قسم أضافه المختبر'), 'the edits stay after a reload: title, paragraph, table, section');
  ok(view.includes('فصل خاص بمختبرنا') && await p.locator('[data-testid="guide-toc"] a').count() === 14, 'a new chapter, in the contents too');
  ok(view.includes('وصف الأهمية بصياغة المختبر.'), 'a category\'s description edited');
  const g = await kv(p, 'training.guide.v1');
  ok(g && g.chapters.length === 14, 'kept on the device (training.guide.v1)');
  // Back to the built-in text: one chapter, then the whole guide.
  p.on('dialog', (d) => d.accept());
  await p.click('[data-testid="guide-edit"]');
  await p.locator('section[data-chapter="intro"] [data-testid="guide-chapter-restore"]').click();
  ok(await settled(async () => (await p.locator('section[data-chapter="intro"] input[aria-label="عنوان الفصل"]').inputValue()) === 'المختبر من الصفر'), 'a chapter back to its original text');
  await p.click('[data-testid="guide-restore"]');
  ok(await settled(async () => await p.locator('section[data-editing]').count() === 13), 'the whole guide back to the original');
  await p.click('[data-testid="guide-edit"]');
  ok(!(await p.locator('main .no-print').innerText()).includes('فصل خاص بمختبرنا'), 'the added chapter gone');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
