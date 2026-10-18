// «تصميم التقرير» (Lab station → Settings → «التقرير المطبوع»): the classic letterhead by default
// (no waves), «الموجة» chosen there — waves at the top and bottom (fixed in print, so on every page,
// with no see-through layer Chrome would drop on later pages), the name centred, the footer as text
// over a thin line — its colours offered, pre-printed paper keeping the classic sheet, and back.
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
  await p.goto(B + '/station/settings#report'); await p.waitForSelector('[data-testid="report-design"]', { timeout: 20000 });
  await p.waitForSelector('#report-sheet', { timeout: 20000 });
  const sheet = () => p.locator('#report-sheet').first();
  ok(await sheet().getAttribute('data-design') === 'classic' && await p.locator('[data-testid="report-wave-top"]').count() === 0, 'classic by default: no waves');
  ok(await p.locator('[data-testid="report-design-classic"]').getAttribute('aria-checked') === 'true', 'the classic design is the one chosen');

  await p.click('[data-testid="report-design-wave"]'); await p.waitForTimeout(600);
  ok((await kv(p, 'station.settings.v1'))?.reportDesign === 'wave', '«الموجة» is saved');
  ok(await sheet().getAttribute('data-design') === 'wave' && await p.locator('[data-testid="report-wave-top"]').count() >= 1 && await p.locator('[data-testid="report-wave-bottom"]').count() >= 1, 'the preview has the waves at the top and bottom');
  ok(await p.locator('[data-testid="report-head"][data-design="wave"]').count() >= 1, 'the letterhead is the wave one (the name centred)');
  ok(await p.locator('[data-testid="report-wave-top"] [opacity], [data-testid="report-wave-bottom"] [opacity]').count() === 0, 'no see-through layer in the waves (Chrome leaves those out on later pages)');

  await p.click('[data-testid="report-design-colors"] button'); await p.waitForTimeout(500);
  const t = (await kv(p, 'station.settings.v1'))?.reportTable;
  ok(t?.primary === '#1f9a7a' && t?.accent === '#3a8fcf' && await p.locator('[data-testid="report-design-colors"]').count() === 0, '«استعمالها»: the teal and blue colours, and the offer goes away');

  // The sheet that prints: the entry screen's.
  await p.goto(B + '/station'); await p.waitForSelector('#report-sheet[data-design="wave"]', { timeout: 20000 });
  await p.emulateMedia({ media: 'print' });
  const pos = await p.evaluate(() => ['report-wave-top', 'report-wave-bottom'].map((id) => getComputedStyle(document.querySelector(`#report-sheet [data-testid="${id}"]`)).position));
  ok(pos.every((x) => x === 'fixed'), `in print the waves are fixed to the page, so on every page (${pos.join(', ')})`);
  await p.emulateMedia({ media: 'screen' });

  await p.goto(B + '/station/settings#report'); await p.waitForSelector('[data-testid="report-design"]', { timeout: 20000 });
  ok(await p.locator('[data-testid="report-design-wave"]').getAttribute('aria-checked') === 'true', 'kept after a reload');
  await p.click('button[role="switch"][aria-label="الطباعة على ورق المختبر المطبوع مسبقاً"]'); await p.waitForTimeout(500);
  ok(await sheet().getAttribute('data-design') === 'classic' && (await p.locator('[data-testid="report-design"]').innerText()).includes('المطبوع مسبقاً'), 'pre-printed paper keeps its own letterhead: no waves, and the card says why');
  await p.click('button[role="switch"][aria-label="الطباعة على ورق المختبر المطبوع مسبقاً"]'); await p.waitForTimeout(500);

  await p.click('[data-testid="report-design-classic"]'); await p.waitForTimeout(500);
  ok(!(await kv(p, 'station.settings.v1'))?.reportDesign && await p.locator('[data-testid="report-wave-top"]').count() === 0, 'back to the classic design: no waves, nothing kept');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
