// A device activated with a lab code keeps working without internet (the license is verified
// offline — its library must be in the saved copy), and prints the patient barcode.
const { B, OWNER, ok, launch, done } = require('./lib.cjs');
const HDR = { 'x-forwarded-for': '10.20.30.41' };
const LAB = 'مختبر بدون إنترنت ' + Date.now().toString(36); // own address: codes.manager trips the attempt limit
(async () => {
  const b = await launch();
  const errs = [];
  const q = await (await b.newContext({ extraHTTPHeaders: HDR })).newPage();
  await q.goto(B + '/licenses');
  const api = (body) => q.evaluate(async (body) => (await fetch('/api/license/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), body);
  const login = await api({ op: 'login', password: OWNER });
  ok(login.ok === true, 'owner signs in (API)');
  const made = await api({ op: 'create', lab: LAB, days: 30 });
  ok(!!made.code, 'code created');

  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: HDR });
  const d = await ctx.newPage(); d.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  await d.goto(B + '/welcome'); await d.waitForSelector('input[aria-label="رمز المختبر"]', { timeout: 20000 });
  await d.fill('input[aria-label="رمز المختبر"]', made.code); await d.click('button:has-text("تفعيل")'); await d.waitForTimeout(1500);
  ok(await d.locator('div[role=dialog]').count() === 0, 'device activated');
  // The device reported its app version; the owner sees it as current.
  const g1 = await q.evaluate(async () => (await fetch('/api/license/admin')).json());
  const row1 = g1.licenses.find((r) => r.lab_name === LAB);
  ok(!!g1.version && row1 && row1.app_version === g1.version, `device version reported (${row1 && row1.app_version} / site ${g1.version})`);
  await q.goto(B + '/licenses'); await q.waitForSelector('[data-testid="app-version"]', { timeout: 15000 });
  const box = await q.locator(`div[data-lab="${LAB}"] [data-testid="app-version"]`).innerText();
  ok(box.includes('✓') && box.includes(g1.version), `code manager shows the device version as current (${box.replace(/\n/g, ' ')})`);
  await d.goto(B + '/welcome'); await d.waitForTimeout(800);
  ok((await d.locator('[data-testid="app-version"]').innerText()).includes(g1.version), 'welcome page shows the version');
  // After an app update the device reports at once (not after the usual 6 hours).
  await d.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.version = 'old-version'; s.checkedAt = Date.now(); localStorage.setItem('local.license.v1', JSON.stringify(s)); });
  await d.goto(B + '/station'); await d.waitForTimeout(2500);
  ok(await d.evaluate(() => JSON.parse(localStorage.getItem('local.license.v1')).version) === g1.version, 'a new app version is reported at the next open');
  // The codes service failing (errors, error pages) never locks a working device.
  for (const [label, fulfill] of [
    ['500 page', { status: 500, contentType: 'text/html', body: '<h1>Internal Server Error</h1>' }],
    ['503 JSON', { status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }],
    ['500 JSON', { status: 500, contentType: 'application/json', body: '{"ok":false,"error":"stopped"}' }],
    ['404 page', { status: 404, contentType: 'text/html', body: 'not found' }],
  ]) {
    let hits = 0;
    await ctx.route('**/api/license**', (route) => { hits++; route.fulfill(fulfill); });
    await d.evaluate(() => { const s = JSON.parse(localStorage.getItem('local.license.v1')); s.checkedAt = 0; localStorage.setItem('local.license.v1', JSON.stringify(s)); });
    await d.goto(B + '/station'); await d.waitForTimeout(2000);
    ok(await d.locator('div[role=dialog]').count() === 0 && await d.evaluate(() => !JSON.parse(localStorage.getItem('local.license.v1')).blocked && localStorage.getItem('local.license.enabled') === '1'),
      `codes service ${label}: device stays open (${hits} failed calls)`);
    ok(hits >= 2, `codes service ${label}: the device did ask (and got the failure)`);
    await ctx.unroute('**/api/license**');
  }
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
