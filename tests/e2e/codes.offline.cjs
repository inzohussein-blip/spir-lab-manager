// A device activated with a lab code keeps working without internet (the license is verified
// offline — its library must be in the saved copy), and prints the patient barcode.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.41' }; // own address: codes.manager trips the attempt limit
(async () => {
  const b = await launch();
  const errs = [];
  const q = await (await b.newContext({ extraHTTPHeaders: HDR })).newPage();
  await q.goto(B + '/licenses');
  const api = (body) => q.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  const login = await api({ op: 'login', password: OWNER });
  ok(login.ok === true, 'owner signs in (API)');
  const made = await api({ op: 'create', lab: 'مختبر بدون إنترنت', days: 30 });
  ok(!!made.code, 'code created');

  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR });
  const d = await ctx.newPage(); d.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await d.goto(B + '/welcome'); await d.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
  await d.fill('input[aria-label="رمز المختبر"]', made.code); await d.click('button:has-text("تفعيل")'); await d.waitForTimeout(1500);
  ok(await d.locator('div[role=dialog]').count() === 0, 'device activated');
  let saved = null;
  for (let i = 0; i < 180 && !saved; i++) {
    await d.waitForTimeout(1000);
    saved = await d.evaluate(async () => { const m = await (await caches.open('local-meta')).match('/__local-meta'); return m ? (await m.json()).build : null; });
  }
  ok(!!saved, 'offline copy saved');

  await ctx.setOffline(true);
  await d.goto(B + '/station'); await d.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 20000 }); await d.waitForTimeout(1500);
  ok(await d.locator('div[role=dialog]').count() === 0, 'offline: station open (license verified without internet)');
  ok(await d.locator('text=يعمل بالتفعيل السابق').count() === 0, 'offline: no «previous activation» notice');
  await d.locator('label:has-text("الاسم الثلاثي") input').fill('مريض الرمز بدون إنترنت');
  await d.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await d.waitForTimeout(100);
  await d.locator('div.grid button:has(span.flex-1)').first().click();
  await d.fill('input[placeholder="ابحث عن فحص…"]', ''); await d.locator('[data-result-idx="0"]').fill('95');
  await d.evaluate(() => { window.print = () => { window.__barcodeAtPrint = document.querySelectorAll('.report-pbc svg').length; }; });
  await d.click('button:has-text("طباعة")');
  await d.waitForFunction(() => window.__barcodeAtPrint !== undefined, null, { timeout: 15000 }).catch(() => {});
  ok(await d.evaluate(() => window.__barcodeAtPrint) === 1, 'offline: patient barcode on the sheet at print time');
  await ctx.setOffline(false);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
