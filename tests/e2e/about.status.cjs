// «عن التطبيق ← حالة الخدمة»: the provider's site reachable or not (the stations go on either way),
// this device's lab code, working offline, the last full backup, and what keeps working without the site.
const { B, ok, launch, done } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  const row = async (id) => ({ tone: await p.getAttribute(`[data-testid="status-${id}"]`, 'data-tone'), text: await p.locator(`[data-testid="status-${id}"]`).innerText() });
  const open = async () => { await p.goto(B + '/about/status'); await p.waitForSelector('[data-testid="status-site"][data-tone]:not([data-tone=""])', { timeout: 20000 }); };
  await open();
  ok((await row('site')).tone === 'ok', 'the site answers: shown as available');
  ok((await row('license')).text.includes('لا يُطلب رمز مختبر'), 'lab codes off: no code asked');
  ok((await row('backup')).tone === 'warn' && (await row('backup')).text.includes('لم تُؤخذ نسخة شاملة'), 'no full backup yet: a warning');
  ok((await p.locator('[data-testid="status-table"] tr').count()) >= 8 && (await p.locator('[data-testid="status-table"]').innerText()).includes('المزامنة بملف'), 'what keeps working without the site, with the other ways');
  ok(await p.locator('aside a[href="/about/status"]').count() === 1, 'it is in the menu of «عن التطبيق»');
  await p.evaluate(() => localStorage.setItem('local.backup.v1', JSON.stringify({ last: Date.now() - 86400000 })));
  await p.route('**/api/license', (r) => r.abort());
  await open();
  ok((await row('site')).tone === 'bad' && (await row('site')).text.includes('تعمل بلا إنترنت'), 'the site out of reach: said plainly, the stations go on');
  ok((await row('backup')).tone === 'ok', 'a backup yesterday: fine');
  await p.unroute('**/api/license');
  await p.route('**/api/license', (r) => r.fulfill({ status: 500, contentType: 'text/html', body: '<h1>error</h1>' }));
  await open();
  ok((await row('site')).tone === 'warn' && (await row('site')).text.includes('500'), 'the site answering an error page: shown');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
