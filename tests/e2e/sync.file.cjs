// «محطة المزامنة»: two computers of the same lab exchange sync files — what one lacks is added,
// a record changed later on the other is taken, one deleted later on the other is deleted, bringing
// the same file in twice changes nothing, and a computer's own file is refused.
const { B, ok, launch, done, kv, resetLocal } = require('./lib.cjs');
(async () => {
  const b = await launch();
  const errs = [];
  const computer = async () => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message.slice(0, 140)}`)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/welcome'); await resetLocal(p, { 'local.activation.v1': 'legacy' });
    return p;
  };
  const stock = async (p) => ((await kv(p, 'station.stock.v1')) || []);
  const addStock = async (p, name, qty) => {
    await p.goto(B + '/store/inventory'); await p.waitForSelector('label:has-text("اسم الصنف") input', { timeout: 20000 });
    await p.fill('label:has-text("اسم الصنف") input', name);
    await p.fill('input[aria-label="الكمية"]', String(qty));
    await p.click('button:has-text("إضافة")'); await p.waitForTimeout(500);
  };
  const exportFrom = async (p, name) => {
    await p.goto(B + '/sync'); await p.waitForSelector('[data-testid="sync-export"]', { timeout: 20000 });
    if (name) { await p.fill('input[aria-label="اسم الحاسوب"]', name); await p.locator('input[aria-label="اسم الحاسوب"]').blur(); }
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="sync-export"]')]);
    return dl.path();
  };
  const importInto = async (p, file) => {
    await p.goto(B + '/sync'); await p.waitForSelector('[data-testid="sync-export"]', { timeout: 20000 });
    await p.setInputFiles('[data-testid="sync-file"]', file);
    await p.waitForSelector('[data-testid="sync-result"]', { timeout: 15000 });
    return p.getByTestId('sync-result').innerText();
  };
  const num = (text, word) => Number((text.match(new RegExp(`${word}\\s*(\\d+)`)) || [])[1]);

  const stamp = Date.now().toString(36);
  const SA = `كاشف الحاسوب الأول ${stamp}`, SC = `كاشف الحاسوب الثاني ${stamp}`;
  const A = await computer(), C = await computer();

  // The station is on the welcome page, open to every activated computer.
  await A.goto(B + '/welcome'); await A.waitForTimeout(800);
  ok(await A.locator('[data-testid="sync-card"]').count() === 1, 'welcome: «محطة المزامنة» among the stations');

  await addStock(A, SA, 5); await addStock(A, 'Test Kit', 1);
  await addStock(C, SC, 7); await addStock(C, 'Test Kit', 2);
  const fileA = await exportFrom(A, 'حاسوب الاستقبال');
  ok((await A.getByTestId('sync-counts').innerText()).includes('محطة المختبر'), 'this computer: its records per station');

  // ── C brings A's file in: A's items are added, C's own are kept ──
  const r1 = await importInto(C, fileA);
  ok(r1.includes('حاسوب الاستقبال') && num(r1, 'أُضيف') >= 2, `C: A's records added (${r1.replace(/\s+/g, ' ')})`);
  const cs = await stock(C);
  ok(cs.some((s) => s.name === SA) && cs.some((s) => s.name === SC), 'C now has both stock items');
  ok((await C.getByTestId('sync-dupes').innerText().catch(() => '')).includes('test kit'), 'the item both computers entered as «Test Kit» is listed to merge by hand');
  const r2 = await importInto(C, fileA);
  ok(num(r2, 'أُضيف') === 0 && num(r2, 'حُدّث') === 0 && num(r2, 'حُذف') === 0, 'the same file again changes nothing');
  ok((await C.getByTestId('sync-log').innerText()).includes('حاسوب الاستقبال'), 'the sync log names the other computer');

  // ── Back to A; then A changes SA's quantity and deletes SC: C follows ──
  const fileC = await exportFrom(C, 'حاسوب المختبر');
  const r3 = await importInto(A, fileC);
  ok((await stock(A)).some((s) => s.name === SC) && num(r3, 'أُضيف') >= 1, 'A gets C\'s item');
  ok(!(await importInto(A, (await exportFrom(A)))).includes('تمت'), 'a computer\'s own file is refused');
  await A.goto(B + '/store/inventory'); await A.waitForSelector('label:has-text("اسم الصنف") input', { timeout: 20000 });
  await A.locator('tbody tr', { hasText: SA }).first().locator('td').last().locator('button').first().click();
  await A.fill('input[aria-label="الكمية"]', '42');
  await A.click('button:has-text("حفظ التعديل")'); await A.waitForTimeout(600);
  await A.locator('tbody tr', { hasText: SC }).first().locator('td').last().locator('button').last().click(); await A.waitForTimeout(1200);
  const r4 = await importInto(C, await exportFrom(A));
  const after = await stock(C);
  ok(after.find((s) => s.name === SA)?.qty === 42 && num(r4, 'حُدّث') >= 1, `C takes the later change to SA (${r4.replace(/\s+/g, ' ')})`);
  ok(!after.some((s) => s.name === SC) && num(r4, 'حُذف') >= 1, 'and the deletion of SC');

  // ── Settings: a station kept to this computer stays out of the file ──
  await C.goto(B + '/sync/settings'); await C.waitForSelector('[data-testid="sync-stations"]', { timeout: 20000 });
  await C.uncheck('input[aria-label="مشاركة المشتريات"]');
  ok((await C.getByTestId('sync-settings-msg').innerText()).includes('حُفظ'), 'sync settings: a station kept to this computer');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
