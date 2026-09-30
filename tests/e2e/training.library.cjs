// The training station's library: every test of the lab station's built-in list, explained; added
// once to stations that had the first five examples (edits kept); deleted ones brought back.
const { B, ok, launch, done, kv, kvPut, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  const settled = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  const tests = async () => (await kv(p, 'training.tests.v1')) || [];

  // ── A new station: the whole library ──
  await p.goto(B + '/station'); await p.waitForTimeout(1200); // the lab's list, to compare
  const lab = (await kv(p, 'station.tests.v1')) || [];
  await p.goto(B + '/training'); await p.waitForTimeout(1500);
  const all = await tests();
  ok(all.length === 93, `every lab test is in the library (${all.length} = 92 + صورة الدم الكاملة)`);
  const codes = new Set(all.map((t) => t.abbr?.toUpperCase()));
  const missing = lab.filter((t) => !codes.has(t.code?.toUpperCase()) && !(t.code === 'GUE' && codes.has('GUE')));
  ok(missing.length === 0, `no lab test missing (${missing.map((t) => t.code).join(', ') || 'none'})`);
  const labCats = new Set(lab.map((t) => t.category));
  ok([...labCats].every((c) => all.some((t) => t.category === c)), 'the lab station\'s categories');
  const thin = all.filter((t) => !t.purpose || !t.summary || !t.steps?.length || !t.tips?.length || !t.normals?.length || !t.sampleType);
  ok(thin.length === 0, `each test explained: purpose, method, sample, steps, notes, normal values (${thin.map((t) => t.abbr).join(', ') || 'all'})`);
  const tubes = new Set(((await kv(p, 'training.tubes.v1')) || []).map((t) => t.id));
  const tools = new Set(((await kv(p, 'training.tools.v1')) || []).map((t) => t.id));
  const ids = new Set(all.map((t) => t.id));
  const broken = all.flatMap((t) => [...t.tubeIds.filter((x) => !tubes.has(x)), ...t.toolIds.filter((x) => !tools.has(x)), ...t.links.map((l) => l.id).filter((x) => !ids.has(x))]);
  ok(broken.length === 0, `tubes, tools and links all exist (${broken.join(', ') || 'none broken'})`);
  const ferr = all.find((t) => t.id === 'x-ferr');
  ok(ferr && JSON.stringify(ferr.normals).includes('30 – 400 ng/mL') && JSON.stringify(ferr.normals).includes('13 – 150 ng/mL'), 'normal values from the lab station\'s list (Ferritin: males / females)');

  // The test page shows it.
  await p.goto(B + '/training/test/x-tsh'); await p.waitForTimeout(1500);
  const page = await p.locator('main').innerText();
  await p.click('button:has-text("طريقة العمل")'); await p.waitForTimeout(300);
  const how = await p.locator('main').innerText();
  await p.click('button:has-text("النتائج والتفسير")'); await p.waitForTimeout(300);
  const res = await p.locator('main').innerText();
  ok(page.includes('الغدة الدرقية') && page.includes('البيوتين') && how.includes('الكارتردج') && res.includes('0.27') && res.includes('قصور الدرقية'),
    'a test\'s page: purpose and notes, its steps, and its normal value and causes (TSH)');
  await p.goto(B + '/training'); await p.waitForTimeout(1200);
  ok((await p.locator('main').innerText()).includes('فحوصات TORCH'), 'the library lists the categories');

  // ── A station that had the first five: the rest added once, its edits kept ──
  const five = all.filter((t) => ['x-fbs', 'x-cbc', 'x-gue', 'x-alt', 'x-ast'].includes(t.id)).map((t) => (t.id === 'x-fbs' ? { ...t, summary: 'ملخص عدّله المختبر' } : t));
  await kvPut(p, 'training.tests.v1', five);
  await kvPut(p, 'training.library.v1', null);
  await p.goto(B + '/training'); await p.waitForTimeout(1500);
  const up = await tests();
  ok(up.length === 93 && up.find((t) => t.id === 'x-fbs')?.summary === 'ملخص عدّله المختبر', `an older station: the library added (${up.length}), its edited test kept`);
  await kvPut(p, 'training.tests.v1', up.filter((t) => t.id !== 'x-fbs' && t.id !== 'x-vitd'));
  await p.goto(B + '/training'); await p.waitForTimeout(1200);
  ok((await tests()).length === 91, 'deleted tests are not brought back by themselves');

  // ── Settings: bring deleted library tests back ──
  await p.goto(B + '/training/settings#device'); await p.waitForSelector('[data-testid="library-card"]', { timeout: 20000 });
  await p.click('[data-testid="library-restore"]');
  ok(await settled(async () => (await tests()).length === 93) && (await p.locator('[data-testid="library-card"] [role=status]').innerText()).includes('2'), '«إضافة فحوصات المكتبة الناقصة» brings the 2 back');
  await p.click('[data-testid="library-restore"]');
  ok((await p.locator('[data-testid="library-card"] [role=status]').innerText()).includes('موجودة'), 'and says when nothing is missing');

  // ── Trainees: a training-completion certificate and a recommendation letter ──
  await p.goto(B + '/training/trainees'); await p.waitForSelector('input[placeholder="الاسم"]', { timeout: 20000 });
  await p.click('button[aria-pressed]:has-text("موظف")');
  await p.fill('input[placeholder="الاسم"]', 'موظف سابق للتجربة'); await p.click('button:has-text("إضافة")');
  const cc = p.locator('[data-testid="completion-card"]'); await cc.waitFor({ timeout: 10000 });
  await cc.locator('input[aria-label="البرنامج"]').fill('التحليلات المرضية العامة');
  await cc.locator('select[aria-label="التقدير"]').selectOption('امتياز');
  await p.evaluate(() => { window.print = () => {}; });
  await cc.locator('[data-testid="completion-print-btn"]').click();
  const tr0 = async () => ((await kv(p, 'training.trainees.v1')) || [])[0];
  ok(await settled(async () => (await tr0())?.completion?.certNo?.startsWith('TRN-') && (await tr0()).role === 'employee'), 'the completion certificate saved with its number (an employee record)');
  const cert = await p.locator('[data-testid="completion-print"]').innerText();
  ok(cert.includes('شهادة انتهاء تدريب') && cert.includes('موظف سابق للتجربة') && cert.includes('امتياز'), 'printed: «شهادة انتهاء تدريب» with the name, program and grade');
  const rc = p.locator('[data-testid="recommendation-card"]');
  ok(await rc.locator('button[aria-pressed="true"]:has-text("موظف سابق")').count() === 1, 'the recommendation starts as for a former employee');
  await rc.locator('input[aria-label="المسمى الوظيفي"]').fill('محلل مختبر');
  await rc.locator('[data-testid="recommendation-suggest"]').click();
  ok((await rc.locator('textarea[aria-label="نص التوصية"]').inputValue()).includes('بوظيفة محلل مختبر'), 'a suggested text from the details');
  await rc.locator('input[aria-label="اسم الموصي"]').fill('د. المدير');
  await rc.locator('[data-testid="recommendation-print-btn"]').click();
  ok(await settled(async () => (await tr0())?.recommendation?.by === 'د. المدير'), 'the recommendation saved');
  const letter = await p.locator('[data-testid="recommendation-print"]').innerText();
  ok(letter.includes('كتاب توصية') && letter.includes('إلى من يهمه الأمر') && letter.includes('د. المدير') && letter.includes('محلل مختبر'), 'printed: the letter with its addressee, text and signature');

  // A quiz can use the whole library.
  await p.goto(B + '/training/quiz'); await p.waitForTimeout(1500);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
