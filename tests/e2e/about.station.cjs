// «عن التطبيق»: a station that explains the app and each station with simplified pictures —
// a sidebar like the others, fixed text (nothing to edit), and very simple settings.
const { B, ok, launch, done, resetLocal } = require('./lib.cjs');
const SLUGS = ['', 'start', 'station', 'report', 'store', 'training', 'qc', 'roster', 'sync', 'admin', 'data', 'tips', 'faq', 'support'];
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`));
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  await p.goto(B + '/welcome');

  // From the welcome page.
  await p.click('[data-testid="about-card"]');
  await p.waitForSelector('[data-testid="about-page"]', { timeout: 20000 });
  ok(new URL(p.url()).pathname === '/about', 'the welcome page opens «عن التطبيق»');
  const nav = await p.locator('aside nav a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  ok(nav.length === SLUGS.length + 1 && nav[0] === '/about' && nav.includes('/about/qc') && nav[nav.length - 1] === '/about/settings', `a sidebar with every page and the settings (${nav.length})`);
  const home = await p.locator('main').innerText();
  ok(['محطة المختبر', 'المخزن والمشتريات', 'التدريب والمعلومات', 'الجودة والأجهزة', 'الكادر والدوام', 'المزامنة'].every((s) => home.includes(s)), 'the overview lists every station');
  ok(await p.locator('main [data-art="hub"] svg').count() === 1, 'with a picture of the stations');

  // Every page: its text, its pictures, the way to the station.
  let arts = 0; const empty = [];
  for (const s of SLUGS) {
    await p.goto(B + '/about' + (s ? '/' + s : '')); await p.waitForSelector('[data-testid="about-page"]', { timeout: 20000 });
    const sections = await p.locator('main section').count();
    if (!sections) empty.push(s || 'home');
    arts += await p.locator('main [data-art]').count();
  }
  ok(empty.length === 0, `every page has its explanation (${SLUGS.length} pages${empty.length ? '; empty: ' + empty.join(', ') : ''})`);
  ok(arts >= 14, `simplified pictures (${arts})`);
  await p.goto(B + '/about/qc');
  const qc = await p.locator('main').innerText();
  ok(qc.includes('Westgard') && qc.includes('Levey-Jennings') && (await p.locator('main [data-art="qc"]').count()) === 1, 'a station in detail (quality: Westgard, the chart and its picture)');
  ok((await p.locator('[data-testid="about-open"]').getAttribute('href')) === '/qc', '«فتح المحطة» goes to the station');
  await p.click('[data-testid="about-next"]'); await p.waitForURL(/\/about\/roster$/);
  ok(true, 'the next page follows');
  await p.goto(B + '/about/faq');
  const q = p.locator('[data-testid="about-faq"] details').first();
  await q.locator('summary').click();
  ok(await q.evaluate((d) => d.open), 'a question opens to its answer');
  await p.goto(B + '/about/support');
  ok((await p.locator('main').innerText()).includes('07803993585'), 'the support number');

  // Fixed text: nothing to type or edit on the pages.
  const editable = await p.evaluate(() => document.querySelectorAll('main input, main textarea, main select, main [contenteditable="true"]').length);
  ok(editable === 0, 'the text cannot be changed (no fields on the pages)');

  // Very simple settings: the look and the text size.
  await p.goto(B + '/about/settings'); await p.waitForSelector('[data-testid="about-text-size"]', { timeout: 20000 });
  ok(await p.locator('main section, main > div > div').count() <= 4, 'the settings are short');
  await p.click('[data-testid="about-text-size"] button:has-text("كبير")');
  ok(await p.locator('main').getAttribute('data-text-size') === 'large', 'a larger text size at once');
  await p.goto(B + '/about/store'); await p.waitForSelector('[data-testid="about-page"]');
  ok(await p.locator('main').getAttribute('data-text-size') === 'large', 'kept on the other pages');
  await p.goto(B + '/about/settings'); await p.waitForSelector('[data-testid="about-text-size"]');
  await p.click('[data-testid="about-text-size"] button:has-text("عادي")');
  await p.click('button:has-text("غامق")');
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'the dark look');
  await p.click('button:has-text("فاتح")');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
