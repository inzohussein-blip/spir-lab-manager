const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
// Station data in IndexedDB: moving an older install, two open tabs, the space meter.
(async () => {
  const b = await launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
  // An install from before the move: its data is in localStorage.
  await p.goto(B + '/welcome');
  await resetLocal(p, {
    'local.activation.v1': 'legacy',
    'station.settings.v1': JSON.stringify({ labName: 'مختبر الترحيل', labSubtitle: '' }),
    'station.theme.v1': 'dark',
  });
  await p.goto(B + '/station/settings'); await p.waitForSelector('[data-testid="storage-usage"]', { timeout: 15000 });
  ok(await p.locator('input[value="مختبر الترحيل"]').count() === 1, 'older data shows after the move');
  const left = await p.evaluate(() => ({ s: localStorage.getItem('station.settings.v1'), t: localStorage.getItem('station.theme.v1') }));
  ok(left.s === null, 'moved data is removed from localStorage');
  ok(left.t === 'dark', 'the theme choice stays in localStorage (applied before paint)');
  ok((await kv(p, 'station.settings.v1'))?.labName === 'مختبر الترحيل', 'data is in IndexedDB');
  const meter = await p.locator('[data-testid="storage-usage"]').innerText();
  ok(meter.includes('المساحة المستخدمة') && !meter.includes('المخزن الصغير'), 'space meter shows the large store');
  await p.reload(); await p.waitForSelector('[data-testid="storage-usage"]');
  ok(await p.locator('input[value="مختبر الترحيل"]').count() === 1, 'data still there after reload');

  // Two tabs open on the station: a visit saved in each keeps both.
  const tab = async () => {
    const t = await ctx.newPage(); t.on('pageerror', (e) => errs.push(e.message.slice(0, 140))); t.on('dialog', (d) => d.accept());
    await t.goto(B + '/station'); await t.waitForSelector('input[placeholder="ابحث عن فحص…"]', { timeout: 15000 });
    return t;
  };
  const save = async (t, name) => {
    await t.locator('label:has-text("الاسم الثلاثي") input').fill(name);
    await t.fill('input[placeholder="ابحث عن فحص…"]', 'Glucose'); await t.waitForTimeout(100);
    await t.locator('div.grid button:has(span.flex-1)').first().click();
    await t.fill('input[placeholder="ابحث عن فحص…"]', '');
    await t.locator('[data-result-idx="0"]').fill('95');
    await t.keyboard.press('Control+s'); await t.waitForTimeout(500);
  };
  const t1 = await tab(), t2 = await tab();
  await save(t1, 'مراجع التبويب الأول');
  await save(t2, 'مراجع التبويب الثاني');
  const names = ((await kv(t1, 'station.visits.v1')) || []).map((v) => v.patient.name);
  ok(names.length === 2, `two tabs: both visits kept (${names.length})`);
  const t3 = await tab();
  await t3.goto(B + '/station/visits'); await t3.waitForTimeout(1200);
  const body = await t3.locator('body').innerText();
  ok(body.includes('مراجع التبويب الأول') && body.includes('مراجع التبويب الثاني'), 'a new tab lists both visits');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
