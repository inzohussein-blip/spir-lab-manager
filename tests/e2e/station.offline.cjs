// The stations without internet: the offline copy installs, then (network off) a report is
// entered and printed with its patient barcode, the lab QR code and the bundled Arabic font.
const { B, ok, launch, done, resetLocal, kvPut, kv } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  // What the worker answered (shown when the copy is not saved).
  await p.addInitScript(() => { window.__sw = []; navigator.serviceWorker?.addEventListener('message', (e) => { const d = e.data || {}; if (d.status !== 'progress') window.__sw.push(d.status + (d.error ? ': ' + d.error : '')); }); });
  // The first download fails part-way (one page answers 500): it must be retried on its own.
  let failedOnce = false;
  await ctx.route('**/roster/staff', (route) => { if (failedOnce) return route.continue(); failedOnce = true; return route.fulfill({ status: 500, body: 'down' }); });
  await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' }); await p.reload();
  // Wait until the service worker saved the whole app (local-sw.js → "installed").
  let saved = null;
  for (let i = 0; i < 180 && !saved; i++) {
    await p.waitForTimeout(1000);
    saved = await p.evaluate(async () => {
      const m = await (await caches.open('local-meta')).match('/__local-meta');
      return m ? (await m.json()).build : null;
    });
  }
  const pageBuild = await p.evaluate(() => document.querySelector('meta[name="lab-build"]')?.content);
  ok(!!saved && saved === pageBuild, `offline copy saved for this build (${saved} / ${pageBuild})` + (saved ? '' : ' — worker: ' + JSON.stringify(await p.evaluate(() => window.__sw))));
  if (!saved) throw new Error('no offline copy — the rest of this file needs it');
  const answers = await p.evaluate(() => window.__sw);
  ok(failedOnce && answers[0]?.startsWith('error') && answers.includes('installed'), `a failed download is retried without reopening the page (${answers.join(' → ')})`);
  await ctx.unroute('**/roster/staff');
  const counts = await p.evaluate(async () => {
    const meta = await (await (await caches.open('local-meta')).match('/__local-meta')).json();
    const keys = (await (await caches.open(meta.cache)).keys()).map((r) => new URL(r.url).pathname);
    return { total: keys.length, fonts: keys.filter((k) => /\.woff2?$/.test(k)).length };
  });
  ok(counts.fonts >= 4, `Arabic font files saved offline (${counts.fonts} of ${counts.total} files)`);
  // Lab QR on, so the QR library is exercised offline too.
  await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
  await kvPut(p, 'station.settings.v1', { ...(await kv(p, 'station.settings.v1')), labQr: true, labPhone: '07800000000' });

  await ctx.setOffline(true);
  await p.goto(B + '/station'); await p.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 });
  ok(true, 'station opens with the network off');
  await p.locator('label:has-text("الاسم الثلاثي") input').fill('مريض بدون إنترنت');
  await p.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await p.waitForTimeout(100);
  await p.locator('div.grid button:has(span.flex-1)').first().click();
  await p.fill('input[placeholder="ابحث عن فحص…"]', '');
  await p.locator('[data-result-idx="0"]').fill('95');
  await p.evaluate(() => { window.print = () => {}; });
  await p.click('button:has-text("طباعة")'); await p.waitForTimeout(2500);
  ok(await p.locator('.report-pbc svg').count() === 1, 'offline: patient barcode on the report');
  ok(await p.locator('.report-qr img, .report-qr canvas, .report-qr svg').count() >= 1, 'offline: lab QR code on the report');
  const font = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "IBM Plex Sans Arabic"', 'مختبر'); });
  ok(font, 'offline: Arabic font loaded');
  await ctx.setOffline(false);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
